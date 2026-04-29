/**
 * PermissionsSettings.tsx
 * Matriz de permissões: Módulos × Perfis de usuário.
 *
 * O Administrador mantém acesso total e não pode ser restringido.
 * Cada célula da matriz é um toggle on/off.
 * A linha final controla a visibilidade de valores financeiros por perfil.
 */

import React, { useState, useCallback } from 'react';
import { UserRole, TenantRolePermissions, RoleModulePermissions } from '../types';
import { savePermissions, loadPermissions, DEFAULT_PERMISSIONS } from '../services/permissionsService';

// ─── Configuração dos módulos exibidos na matriz ───────────────────────────────

interface ModuleMeta {
  id: keyof RoleModulePermissions;
  label: string;
  icon: string;
  group: 'operacional' | 'juridico' | 'admin';
  description: string;
}

const MODULES: ModuleMeta[] = [
  // Operacional
  { id: 'dashboard',    label: 'Dashboard',         icon: '🏠', group: 'operacional', description: 'Visão geral e indicadores' },
  { id: 'calendar',     label: 'Agenda',             icon: '📅', group: 'operacional', description: 'Eventos e compromissos' },
  { id: 'chat',         label: 'Comunicação',        icon: '💬', group: 'operacional', description: 'Chat interno entre equipe' },
  { id: 'tasks',        label: 'Tarefas',            icon: '✅', group: 'operacional', description: 'Gestão de tarefas' },
  // Jurídico
  { id: 'crm',          label: 'Clientes & CRM',     icon: '👥', group: 'juridico',    description: 'Cadastro e funil de clientes' },
  { id: 'cases',        label: 'Processos',          icon: '⚖️', group: 'juridico',    description: 'Gestão de processos jurídicos' },
  { id: 'deadlines',    label: 'Prazos',             icon: '⏰', group: 'juridico',    description: 'Controle de prazos processuais' },
  { id: 'hearings',     label: 'Audiências',         icon: '🏛️', group: 'juridico',    description: 'Agendamento de audiências' },
  { id: 'publications', label: 'Publicações DJEN',   icon: '📰', group: 'juridico',    description: 'Monitoramento do diário de justiça' },
  { id: 'ia',           label: 'IA Jurídica',        icon: '🤖', group: 'juridico',    description: 'Geração de petições com IA' },
  { id: 'whatsapp_crm', label: 'CRM WhatsApp',       icon: '📱', group: 'juridico',    description: 'Atendimento via WhatsApp (Enterprise)' },
  // Admin
  { id: 'finance',      label: 'Financeiro',         icon: '💰', group: 'admin',       description: 'Lançamentos e fluxo de caixa' },
  { id: 'settings',     label: 'Configurações',      icon: '⚙️', group: 'admin',       description: 'Administração do sistema' },
];

const ROLE_META: { role: UserRole; label: string; color: string; bg: string; locked?: boolean }[] = [
  { role: UserRole.ADMIN,     label: 'Administrador', color: '#7c3aed', bg: '#ede9fe', locked: true },
  { role: UserRole.LAWYER,    label: 'Advogado',      color: '#1d4ed8', bg: '#dbeafe' },
  { role: UserRole.INTERN,    label: 'Estagiário',    color: '#0369a1', bg: '#e0f2fe' },
  { role: UserRole.RECEPTION, label: 'Secretaria',    color: '#0f766e', bg: '#ccfbf1' },
  { role: UserRole.FINANCE,   label: 'Financeiro',    color: '#b45309', bg: '#fef3c7' },
];

const GROUP_LABELS: Record<string, string> = {
  operacional: 'Operacional',
  juridico:    'Jurídico',
  admin:       'Administração',
};

// ─── Toggle Switch ─────────────────────────────────────────────────────────────

const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}> = ({ checked, onChange, disabled = false, size = 'md' }) => {
  const w = size === 'sm' ? 32 : 40;
  const h = size === 'sm' ? 18 : 22;
  const r = size === 'sm' ? 14 : 18;
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      style={{
        width: w, height: h, borderRadius: h / 2, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        background: disabled ? '#e5e7eb' : checked ? '#22c55e' : '#d1d5db',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0, padding: 0,
        opacity: disabled ? 0.6 : 1,
      }}
      title={disabled ? 'Administrador sempre tem acesso total' : checked ? 'Clique para desativar' : 'Clique para ativar'}
    >
      <span style={{
        position: 'absolute', top: (h - r) / 2, left: checked ? w - r - (h - r) / 2 : (h - r) / 2,
        width: r, height: r, borderRadius: '50%', background: 'white',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s',
      }} />
    </button>
  );
};

// ─── Componente Principal ─────────────────────────────────────────────────────

interface PermissionsSettingsProps {
  tenantId: string;
}

const PermissionsSettings: React.FC<PermissionsSettingsProps> = ({ tenantId }) => {
  const [perms, setPerms] = useState<TenantRolePermissions>(() => loadPermissions(tenantId));
  const [saved, setSaved] = useState(false);
  const [activeGroup, setActiveGroup] = useState<string | null>(null);

  const persist = useCallback((updated: TenantRolePermissions) => {
    setPerms(updated);
    savePermissions(tenantId, updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [tenantId]);

  function toggleModule(role: UserRole, moduleId: keyof RoleModulePermissions, value: boolean) {
    if (role === UserRole.ADMIN) return; // Admin nunca pode ser restringido
    const updated: TenantRolePermissions = {
      ...perms,
      [role]: {
        ...perms[role],
        modules: { ...perms[role].modules, [moduleId]: value },
      },
    };
    persist(updated);
  }

  function toggleFinancials(role: UserRole, value: boolean) {
    if (role === UserRole.ADMIN) return;
    const updated: TenantRolePermissions = {
      ...perms,
      [role]: { ...perms[role], canViewFinancialValues: value },
    };
    persist(updated);
  }

  function enableAll(role: UserRole) {
    if (role === UserRole.ADMIN) return;
    const allOn = Object.fromEntries(
      MODULES.map(m => [m.id, true])
    ) as unknown as RoleModulePermissions;
    persist({ ...perms, [role]: { modules: allOn, canViewFinancialValues: true } });
  }

  function resetRole(role: UserRole) {
    if (role === UserRole.ADMIN) return;
    persist({ ...perms, [role]: DEFAULT_PERMISSIONS[role] });
  }

  function resetAll() {
    const fresh: TenantRolePermissions = {
      [UserRole.ADMIN]:     DEFAULT_PERMISSIONS[UserRole.ADMIN],
      [UserRole.LAWYER]:    DEFAULT_PERMISSIONS[UserRole.LAWYER],
      [UserRole.INTERN]:    DEFAULT_PERMISSIONS[UserRole.INTERN],
      [UserRole.RECEPTION]: DEFAULT_PERMISSIONS[UserRole.RECEPTION],
      [UserRole.FINANCE]:   DEFAULT_PERMISSIONS[UserRole.FINANCE],
    };
    persist(fresh);
  }

  const groups = ['operacional', 'juridico', 'admin'] as const;

  // ── Visão Mobile: acordeão por perfil ─────────────────────────────────────
  // ── Visão Desktop: tabela matricial ───────────────────────────────────────

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#111827' }}>Controle de Acesso por Perfil</h3>
          <p style={{ margin: '6px 0 0 0', fontSize: 13, color: '#6b7280', lineHeight: 1.5 }}>
            Defina quais módulos cada perfil de usuário pode visualizar e se pode ver valores financeiros.<br/>
            <strong style={{ color: '#7c3aed' }}>Administrador</strong> sempre mantém acesso total e não pode ser restringido.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {saved && (
            <span style={{ fontSize: 12, fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '5px 12px', borderRadius: 20 }}>
              ✓ Salvo
            </span>
          )}
          <button
            onClick={resetAll}
            style={{ padding: '7px 14px', fontSize: 12, fontWeight: 600, color: '#dc2626', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, cursor: 'pointer' }}
          >
            Restaurar Padrões
          </button>
        </div>
      </div>

      {/* Legenda rápida */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {ROLE_META.map(r => (
          <span key={r.role} style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, background: r.bg, color: r.color, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
            {r.locked && '🔒 '}
            {r.label}
          </span>
        ))}
      </div>

      {/* Matriz */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
          <thead>
            <tr>
              <th style={{ padding: '10px 16px', textAlign: 'left', background: '#f9fafb', borderBottom: '2px solid #e5e7eb', fontWeight: 700, color: '#374151', borderRadius: '12px 0 0 0', minWidth: 200 }}>
                Módulo
              </th>
              {ROLE_META.map((r, i) => (
                <th key={r.role} style={{
                  padding: '10px 8px', textAlign: 'center', background: r.bg,
                  borderBottom: '2px solid #e5e7eb', minWidth: 110,
                  borderRadius: i === ROLE_META.length - 1 ? '0 12px 0 0' : 0,
                }}>
                  <div style={{ fontWeight: 800, fontSize: 12, color: r.color }}>{r.label}</div>
                  {!r.locked && (
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginTop: 6 }}>
                      <button
                        onClick={() => enableAll(r.role)}
                        style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, border: '1px solid ' + r.color + '40', background: 'white', color: r.color, cursor: 'pointer', fontWeight: 700 }}
                      >Tudo</button>
                      <button
                        onClick={() => resetRole(r.role)}
                        style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', cursor: 'pointer', fontWeight: 600 }}
                      >Padrão</button>
                    </div>
                  )}
                  {r.locked && (
                    <div style={{ fontSize: 9, color: r.color + '80', marginTop: 4 }}>acesso total</div>
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {groups.map((group, gi) => (
              <React.Fragment key={group}>
                {/* Separador de grupo */}
                <tr>
                  <td colSpan={ROLE_META.length + 1} style={{
                    padding: '10px 16px 6px 16px',
                    background: 'white',
                    fontWeight: 800, fontSize: 11, color: '#9ca3af',
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    borderTop: gi > 0 ? '1px solid #f3f4f6' : 'none',
                  }}>
                    {GROUP_LABELS[group]}
                  </td>
                </tr>

                {MODULES.filter(m => m.group === group).map((mod, mi) => {
                  const isLast = gi === groups.length - 1 && mi === MODULES.filter(m => m.group === group).length - 1;
                  return (
                    <tr key={mod.id} style={{ background: mi % 2 === 0 ? 'white' : '#fafafa' }}>
                      <td style={{
                        padding: '11px 16px',
                        borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{mod.icon}</span>
                          <div>
                            <div style={{ fontWeight: 600, color: '#111827', fontSize: 13 }}>{mod.label}</div>
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{mod.description}</div>
                          </div>
                        </div>
                      </td>
                      {ROLE_META.map(r => (
                        <td key={r.role} style={{
                          padding: '11px 8px', textAlign: 'center',
                          borderBottom: isLast ? 'none' : '1px solid #f3f4f6',
                          background: r.locked ? r.bg + '50' : undefined,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <Toggle
                              checked={perms[r.role]?.modules[mod.id] ?? false}
                              onChange={v => toggleModule(r.role, mod.id, v)}
                              disabled={r.locked}
                            />
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}

            {/* ── Linha especial: Valores financeiros ───────────────────── */}
            <tr>
              <td colSpan={ROLE_META.length + 1} style={{ padding: '14px 16px 6px 16px', background: 'white' }}>
                <div style={{ height: 1, background: '#e5e7eb', marginBottom: 12 }} />
                <div style={{ fontWeight: 800, fontSize: 11, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Visibilidade de Valores Monetários
                </div>
              </td>
            </tr>
            <tr style={{ background: '#fffbeb' }}>
              <td style={{ padding: '14px 16px', borderTop: '1px solid #fde68a' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 20, marginTop: 1 }}>💰</span>
                  <div>
                    <div style={{ fontWeight: 700, color: '#92400e', fontSize: 13 }}>Visualizar valores financeiros</div>
                    <div style={{ fontSize: 11, color: '#b45309', marginTop: 2, lineHeight: 1.5 }}>
                      Quando desativado, todos os valores monetários (honorários, taxas, saldos, fluxo de caixa) aparecem mascarados como <strong>••••</strong> para o perfil em qualquer módulo do sistema.
                    </div>
                  </div>
                </div>
              </td>
              {ROLE_META.map(r => (
                <td key={r.role} style={{ padding: '14px 8px', textAlign: 'center', borderTop: '1px solid #fde68a', background: r.locked ? r.bg + '40' : '#fffbeb' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                    <Toggle
                      checked={perms[r.role]?.canViewFinancialValues ?? false}
                      onChange={v => toggleFinancials(r.role, v)}
                      disabled={r.locked}
                    />
                    <span style={{
                      fontSize: 9, fontWeight: 700,
                      color: perms[r.role]?.canViewFinancialValues ? '#16a34a' : '#dc2626',
                    }}>
                      {r.locked ? '✓ sempre' : perms[r.role]?.canViewFinancialValues ? 'Visível' : 'Mascarado'}
                    </span>
                  </div>
                </td>
              ))}
            </tr>

            {/* Linha de resumo */}
            <tr style={{ background: '#f9fafb' }}>
              <td style={{ padding: '12px 16px', borderTop: '1px solid #e5e7eb', borderRadius: '0 0 0 12px' }}>
                <span style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
                  As alterações têm efeito imediato — os usuários verão as mudanças no próximo login.
                </span>
              </td>
              {ROLE_META.map((r, i) => {
                const mods = perms[r.role]?.modules ?? {};
                const enabled = Object.values(mods).filter(Boolean).length;
                const total = MODULES.length;
                return (
                  <td key={r.role} style={{
                    padding: '12px 8px', textAlign: 'center', borderTop: '1px solid #e5e7eb',
                    borderRadius: i === ROLE_META.length - 1 ? '0 0 12px 0' : 0,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{enabled}/{total}</div>
                    <div style={{ fontSize: 9, color: '#9ca3af' }}>módulos</div>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Nota sobre plano */}
      <div style={{ marginTop: 16, padding: '12px 16px', background: '#eff6ff', borderRadius: 10, border: '1px solid #bfdbfe', fontSize: 12, color: '#1d4ed8', lineHeight: 1.5 }}>
        ℹ️ <strong>Módulos de plano superior</strong> (IA Jurídica, Publicações DJEN, CRM WhatsApp) só aparecem na interface se estiverem disponíveis no plano contratado, independente desta configuração.
      </div>
    </div>
  );
};

export default PermissionsSettings;
