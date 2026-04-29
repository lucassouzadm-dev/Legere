/**
 * permissionsService.ts
 * Gerencia as permissões de módulos e de visualização de valores financeiros
 * por perfil de usuário, por tenant.
 *
 * O Administrador sempre mantém acesso total — esse perfil não pode ser restringido.
 * As permissões são salvas em localStorage (migráveis para Supabase JSONB).
 */

import { UserRole, RoleModulePermissions, RolePermissions, TenantRolePermissions } from '../types';

const PERMISSIONS_KEY_PREFIX = 'juriscloud_rolepermissions_';

// ─── Padrão alinhado com os roles originais do Layout.tsx ─────────────────────

const ALL_MODULES: RoleModulePermissions = {
  dashboard:    true,
  calendar:     true,
  crm:          true,
  cases:        true,
  deadlines:    true,
  hearings:     true,
  tasks:        true,
  ia:           true,
  finance:      true,
  chat:         true,
  publications: true,
  whatsapp_crm: true,
  settings:     true,
};

export const DEFAULT_PERMISSIONS: TenantRolePermissions = {
  [UserRole.ADMIN]: {
    modules: { ...ALL_MODULES },
    canViewFinancialValues: true,
  },
  [UserRole.LAWYER]: {
    modules: {
      dashboard:    true,
      calendar:     true,
      crm:          true,
      cases:        true,
      deadlines:    true,
      hearings:     true,
      tasks:        true,
      ia:           true,
      finance:      false,
      chat:         true,
      publications: true,
      whatsapp_crm: false,
      settings:     true,
    },
    canViewFinancialValues: false,
  },
  [UserRole.INTERN]: {
    modules: {
      dashboard:    true,
      calendar:     true,
      crm:          false,
      cases:        true,
      deadlines:    true,
      hearings:     true,
      tasks:        true,
      ia:           false,
      finance:      false,
      chat:         true,
      publications: true,
      whatsapp_crm: false,
      settings:     true,
    },
    canViewFinancialValues: false,
  },
  [UserRole.RECEPTION]: {
    modules: {
      dashboard:    true,
      calendar:     true,
      crm:          true,
      cases:        true,
      deadlines:    false,
      hearings:     false,
      tasks:        true,
      ia:           false,
      finance:      false,
      chat:         true,
      publications: false,
      whatsapp_crm: false,
      settings:     true,
    },
    canViewFinancialValues: false,
  },
  [UserRole.FINANCE]: {
    modules: {
      dashboard:    true,
      calendar:     false,
      crm:          false,
      cases:        false,
      deadlines:    false,
      hearings:     false,
      tasks:        false,
      ia:           false,
      finance:      true,
      chat:         true,
      publications: false,
      whatsapp_crm: false,
      settings:     true,
    },
    canViewFinancialValues: true,
  },
};

// ─── Persistência ─────────────────────────────────────────────────────────────

export function savePermissions(tenantId: string, perms: TenantRolePermissions): void {
  localStorage.setItem(PERMISSIONS_KEY_PREFIX + tenantId, JSON.stringify(perms));
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

export function loadPermissions(tenantId: string): TenantRolePermissions {
  const raw = localStorage.getItem(PERMISSIONS_KEY_PREFIX + tenantId);
  if (!raw) return deepClone(DEFAULT_PERMISSIONS);
  try {
    const parsed = JSON.parse(raw) as TenantRolePermissions;
    // Garante que o Admin nunca perde o acesso total (proteção extra)
    parsed[UserRole.ADMIN] = deepClone(DEFAULT_PERMISSIONS[UserRole.ADMIN]);
    return parsed;
  } catch {
    return deepClone(DEFAULT_PERMISSIONS);
  }
}

// ─── Helpers de verificação ───────────────────────────────────────────────────

/** Retorna se o módulo está visível para o perfil dado as permissões do tenant */
export function canAccessModule(
  perms: TenantRolePermissions,
  role: UserRole,
  moduleId: keyof RoleModulePermissions
): boolean {
  return perms[role]?.modules[moduleId] ?? false;
}

/** Retorna se o perfil pode ver valores financeiros */
export function canViewFinancials(
  perms: TenantRolePermissions,
  role: UserRole
): boolean {
  return perms[role]?.canViewFinancialValues ?? false;
}

/** Filtra lista de IDs de módulo permitidos para o perfil */
export function allowedModules(
  perms: TenantRolePermissions,
  role: UserRole
): string[] {
  const rp = perms[role];
  if (!rp) return [];
  return (Object.keys(rp.modules) as (keyof RoleModulePermissions)[]).filter(m => rp.modules[m]);
}
