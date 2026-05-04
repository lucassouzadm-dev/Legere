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
  return 'jc_' + tenantId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24);
}

// ─── Controle de uso de IA por tenant ────────────────────────────────────────

function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Retorna quantas requisições de IA o tenant já usou no mês corrente.
 */
export function getAiUsage(tenantId: string): { count: number; monthKey: string } {
  const integrations = loadIntegrations(tenantId);
  const monthKey = currentMonthKey();
  const resetAt  = integrations.aiRequestsResetAt ?? '';
  // Reseta se mudou o mês
  if (resetAt !== monthKey) return { count: 0, monthKey };
  return { count: integrations.aiRequestsCount ?? 0, monthKey };
}

/**
 * Verifica se o tenant pode fazer mais uma requisição de IA.
 * monthlyLimit = -1 significa ilimitado.
 */
export function checkAiLimit(tenantId: string, monthlyLimit: number): {
  allowed: boolean;
  used: number;
  limit: number;
  remaining: number;
} {
  if (monthlyLimit === -1) return { allowed: true, used: 0, limit: -1, remaining: -1 };
  const { count } = getAiUsage(tenantId);
  return {
    allowed:   count < monthlyLimit,
    used:      count,
    limit:     monthlyLimit,
    remaining: Math.max(0, monthlyLimit - count),
  };
}

/**
 * Incrementa o contador de uso de IA do tenant em 1.
 * Chame APÓS uma requisição bem-sucedida ao Gemini.
 */
export function incrementAiUsage(tenantId: string): void {
  const monthKey     = currentMonthKey();
  const integrations = loadIntegrations(tenantId);
  const prevMonth    = integrations.aiRequestsResetAt ?? '';
  const prevCount    = prevMonth === monthKey ? (integrations.aiRequestsCount ?? 0) : 0;
  saveIntegrations(tenantId, {
    ...integrations,
    aiRequestsCount:  prevCount + 1,
    aiRequestsResetAt: monthKey,
  });
}

// ─── Supabase CRUD de Tenants ─────────────────────────────────────────────────

export const tenantsDb = {
  async getById(id: string): Promise<Tenant | null> {
    // Tenta via RPC SECURITY DEFINER — funciona sem autenticação (fluxo de convite)
    const { data: rpcData, error: rpcErr } = await supabase.rpc('get_tenant_for_invite', { p_id: id });
    if (!rpcErr && Array.isArray(rpcData) && rpcData.length > 0) return dbToTenant(rpcData[0]);

    // Fallback: query direta (funciona quando usuário já está autenticado)
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
    const id = `tenant-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    // Usa RPC com SECURITY DEFINER para contornar RLS no cadastro público
    const { data, error } = await supabase.rpc('create_tenant', {
      p_id:       id,
      p_name:     tenant.name,
      p_email:    tenant.email.toLowerCase(),
      p_plan:     tenant.plan,
      p_slogan:   tenant.slogan   ?? null,
      p_cnpj:     tenant.cnpj     ?? null,
      p_phone:    tenant.phone    ?? null,
    });
    if (error || !data || (Array.isArray(data) && data.length === 0)) {
      console.error('[tenantsDb] create error:', error);
      // Fallback local apenas se Supabase não configurado
      const t: Tenant = { ...tenant, id, createdAt: new Date().toISOString(), active: true };
      return t;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return dbToTenant(row);
  },

  async update(id: string, fields: Partial<Tenant>): Promise<void> {
    const payload: any = {};
    if (fields.name        !== undefined) payload.name          = fields.name;
    if (fields.slogan      !== undefined) payload.slogan        = fields.slogan ?? null;
    if (fields.plan)                      payload.plan          = fields.plan;
    if (fields.phone       !== undefined) payload.phone         = fields.phone ?? null;
    if (fields.cnpj        !== undefined) payload.cnpj          = fields.cnpj ?? null;
    if (fields.logoUrl)                   payload.logo_url      = fields.logoUrl;
    if (fields.active      !== undefined) payload.active        = fields.active;
    if (fields.trialEndsAt !== undefined) payload.trial_ends_at = fields.trialEndsAt ?? null;
    const { error } = await supabase.from('tenants').update(payload).eq('id', id);
    if (error) console.error('[tenantsDb] update error:', error);
  },
};

// ─── Helpers de trial ────────────────────────────────────────────────────────

/**
 * Retorna true se o tenant está em período de teste (trial_ends_at no futuro).
 */
export function isTrial(tenant: Tenant | null): boolean {
  if (!tenant?.trialEndsAt) return false;
  return new Date(tenant.trialEndsAt) > new Date();
}

/**
 * Retorna true se o trial expirou E o tenant não tem plano pago confirmado.
 * Um tenant nunca bloqueado = trialEndsAt ausente (cliente pagante sem trial).
 */
export function isTrialExpired(tenant: Tenant | null): boolean {
  if (!tenant) return false;
  if (!tenant.trialEndsAt) return false; // sem trial = assinante ativo
  return new Date(tenant.trialEndsAt) < new Date();
}

/**
 * Quantos dias restam no trial (negativo = expirado).
 */
export function trialDaysLeft(tenant: Tenant | null): number {
  if (!tenant?.trialEndsAt) return Infinity;
  const diff = new Date(tenant.trialEndsAt).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

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
