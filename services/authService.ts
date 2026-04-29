/**
 * authService.ts
 * Camada de autenticação do Legere usando Supabase Auth.
 *
 * Substitui completamente a autenticação manual com senha em texto puro.
 * Supabase Auth usa bcrypt internamente + JWT com expiração.
 *
 * Modo degradado: se o Supabase não estiver configurado (env com placeholder),
 * as funções retornam { success: false, fallback: true } e o App.tsx
 * usa a autenticação local de desenvolvimento como fallback.
 */

import { supabase } from './supabase';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface AuthResult {
  success: boolean;
  fallback?: boolean;   // true = Supabase não configurado, usar localStorage
  error?: string;
  tenantId?: string;
  authUserId?: string;
  role?: string;
  name?: string;
}

export interface SignUpParams {
  email: string;
  password: string;
  tenantId: string;
  name: string;
  role?: string;
  oabNumber?: string;
  oabState?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isSupabaseConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL as string;
  return !!url && !url.includes('placeholder');
}

// ─── Serviço ──────────────────────────────────────────────────────────────────

export const authService = {

  /**
   * Registra o administrador do escritório logo após a criação do tenant.
   * Os metadados (tenant_id, role, name) são gravados em auth.users e
   * o trigger handle_new_auth_user() cria automaticamente a linha em public.users.
   */
  async signUpAdmin(params: SignUpParams): Promise<AuthResult> {
    if (!isSupabaseConfigured()) {
      return { success: false, fallback: true };
    }
    const { data, error } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: {
          tenant_id:  params.tenantId,
          name:       params.name,
          role:       'ADMIN',
          oab_number: params.oabNumber ?? null,
          oab_state:  params.oabState  ?? null,
        },
      },
    });
    if (error) return { success: false, error: error.message };
    return {
      success:    true,
      tenantId:   params.tenantId,
      authUserId: data.user?.id,
      role:       'ADMIN',
      name:       params.name,
    };
  },

  /**
   * Registra um novo membro da equipe (criado pelo admin nas Configurações).
   * O admin define email + senha temporária; o membro troca na primeira sessão.
   */
  async signUpStaff(params: SignUpParams): Promise<AuthResult> {
    if (!isSupabaseConfigured()) {
      return { success: false, fallback: true };
    }
    const { data, error } = await supabase.auth.signUp({
      email: params.email,
      password: params.password,
      options: {
        data: {
          tenant_id:  params.tenantId,
          name:       params.name,
          role:       params.role ?? 'LAWYER',
          oab_number: params.oabNumber ?? null,
          oab_state:  params.oabState  ?? null,
        },
      },
    });
    if (error) return { success: false, error: error.message };
    return {
      success:    true,
      tenantId:   params.tenantId,
      authUserId: data.user?.id,
      role:       params.role ?? 'LAWYER',
      name:       params.name,
    };
  },

  /**
   * Login padrão com email + senha.
   * Retorna os metadados do tenant e role gravados no JWT.
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    if (!isSupabaseConfigured()) {
      return { success: false, fallback: true };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return {
        success: false,
        error: error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : error.message,
      };
    }
    const meta = data.user?.user_metadata ?? {};
    return {
      success:    true,
      tenantId:   meta.tenant_id,
      authUserId: data.user?.id,
      role:       meta.role,
      name:       meta.name,
    };
  },

  /** Encerra a sessão do usuário atual. */
  async signOut(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    await supabase.auth.signOut();
  },

  /** Retorna a sessão ativa (JWT) se existir. */
  async getSession() {
    if (!isSupabaseConfigured()) return null;
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  },

  /**
   * Extrai dados da sessão atual (tenant_id, role, name) do JWT.
   * Útil para restaurar o estado após recarregar a página.
   */
  async getSessionContext(): Promise<AuthResult | null> {
    const session = await authService.getSession();
    if (!session) return null;
    const meta = session.user.user_metadata ?? {};
    return {
      success:    true,
      tenantId:   meta.tenant_id,
      authUserId: session.user.id,
      role:       meta.role,
      name:       meta.name,
    };
  },

  /**
   * Inscreve um callback para mudanças de estado de autenticação.
   * Retorna a função de unsubscribe.
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(callback);
    return () => subscription.unsubscribe();
  },

  /**
   * Envia e-mail de redefinição de senha.
   */
  async sendPasswordReset(email: string): Promise<AuthResult> {
    if (!isSupabaseConfigured()) {
      return { success: false, fallback: true };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  /**
   * Atualiza a senha do usuário logado.
   */
  async updatePassword(newPassword: string): Promise<AuthResult> {
    if (!isSupabaseConfigured()) {
      return { success: false, fallback: true };
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },
};
