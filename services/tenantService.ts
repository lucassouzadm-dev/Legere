/**
 * tenantService.ts
 * Gerencia o contexto de tenant (escritório contratante) em toda a aplicação.
 *
 * O tenant_id é armazenado no localStorage após o login e injetado em
 * todas as operações de banco de dados para garantir isolamento total dos dados.
 */

import { supabase } from './supabase';
import { Tenant, TenantIntegrations, PlanType } from '../types';

const TENANT_KEY = 'legere_tenant_id';
const TENANT_DATA_KEY = 'legere_tenant_data';
const TENANT_INTEGRATIONS_PREFIX = 'legere_integrations_';

// ─── Módulo: tenant atual em memória ─────────────────────────────────────────

let _tenantId: string | null = null;
let _tenant: Tenant | null = null;

export function setCurrentTenant(tenant: Tenant) {
  _tenantId = tenant.id;
  _tenant   = tenant;
  localStorage.setItem(TENANT_KEY, tenant.id);
  localStorage.setItem(TENANT_DATA_KEY, JSON.stringify(tenant));
}

export function getCurrentTenantId(): string {
  if (_tenantId) return _tenantId;
  const stored = localStorage.getItem(TENANT_KEY);
  if (stored) { _tenantId = stored; return stored; }
  return '';
}

export function getCurrentTenant(): Tenant | null {
  if (_tenant) return _tenant;
  const stored = localStorage.getItem(TENANT_DATA_KEY);
  if (stored) {
    try { _tenant = JSON.parse(stored); return _tenant; }
    catch { return null; }
  }
  return null;
}

export function clearCurrentTenant() {
  _tenantId = null;
  _tenant   = null;
  localStorage.removeItem(TENANT_KEY);
  localStorage.removeItem(TENANT_DATA_KEY);
}

// ─── Integrações (salvas localmente; em produção: coluna JSONB no Supabase) ───

export function saveIntegrations(tenantId: string, data: TenantIntegrations): void {
  const key = TENANT_INTEGRATIONS_PREFIX + tenantId;
  localStorage.setItem(key, JSON.stringify(data));
  // Atualiza o tenant em cache para manter consistência
  if (_tenant && _tenant.id === tenantId) {
    _tenant = { ..._tenant, integrations: data };
    localStorage.setItem(TENANT_DATA_KEY, JSON.stringify(_tenant));
  }
}

export function loadIntegrations(tenantId: string): TenantIntegrations {
  // Prefer in-memory tenant data
  if (_tenant?.id === tenantId && _tenant.integrations) return _tenant.integrations;
  const key = TENANT_INTEGRATIONS_PREFIX + tenantId;
  const raw = localStorage.getItem(key);
  if (!raw) return {};
  try { return JSON.parse(raw) as TenantIntegrations; }
  catch { return {}; }
}

/** Gera um verify token determinístico para o webhook Meta (baseado no tenant) */
export function generateVerifyToken(tenantId: string): string {
  // Em produção usar crypto.randomUUID() salvo no DB.
  // Para demo, derivamos do tenant id de forma consistente.
  return 'jc_' + tenantId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
}

// ─── Supabase CRUD de Tenants ─────────────────────────────────────────────────

export const tenantsDb = {
  async getById(id: string): Promise<Tenant | null> {
    const { data, error } = await supabase.from('tenants').select('*').eq('id', id).single();
    if (error || !data) return null;
    return dbToTenant(data);
  },

  async getByEmail(email: string): Promise<Tenant | null> {
    const { data, error } = await supabase.from('tenants').select('*').eq('email', email.toLowerCase()).single();
    if (error || !data) return null;
    return dbToTenant(data);
  },

  async create(tenant: Omit<Tenant, 'id' | 'createdAt'>): Promise<Tenant | null> {
    const newTenant = {
      id: `tenant-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: tenant.name,
      slogan: tenant.slogan ?? null,
      cnpj: tenant.cnpj ?? null,
      phone: tenant.phone ?? null,
      email: tenant.email.toLowerCase(),
      plan: tenant.plan,
      logo_url: tenant.logoUrl ?? null,
      created_at: new Date().toISOString(),
      active: true,
      trial_ends_at: tenant.trialEndsAt ?? null,
    };
    const { data, error } = await supabase.from('tenants').insert(newTenant).select().single();
    if (error || !data) {
      console.error('[tenantsDb] create error:', error);
      // fallback local para demo sem DB
      const t: Tenant = { ...tenant, id: newTenant.id, createdAt: newTenant.created_at, active: true };
      return t;
    }
    return dbToTenant(data);
  },

  async update(id: string, fields: Partial<Tenant>): Promise<void> {
    const payload: any = {};
    if (fields.name   !== undefined) payload.name     = fields.name;
    if (fields.slogan !== undefined) payload.slogan   = fields.slogan ?? null;
    if (fields.plan)                 payload.plan     = fields.plan;
    if (fields.phone  !== undefined) payload.phone    = fields.phone ?? null;
    if (fields.cnpj   !== undefined) payload.cnpj     = fields.cnpj ?? null;
    if (fields.logoUrl)              payload.logo_url = fields.logoUrl;
    if (fields.active !== undefined) payload.active   = fields.active;
    const { error } = await supabase.from('tenants').update(payload).eq('id', id);
    if (error) console.error('[tenantsDb] update error:', error);
  },
};

function dbToTenant(r: any): Tenant {
  return {
    id:           r.id,
    name:         r.name,
    slogan:       r.slogan ?? undefined,
    cnpj:         r.cnpj ?? undefined,
    phone:        r.phone ?? undefined,
    email:        r.email,
    plan:         (r.plan as PlanType) ?? PlanType.ESSENCIAL,
    logoUrl:      r.logo_url ?? undefined,
    createdAt:    r.created_at,
    active:       r.active ?? true,
    trialEndsAt:  r.trial_ends_at ?? undefined,
  };
}
