-- ============================================================
-- Legere SaaS — Fix #002: Grants explícitos para anon/authenticated
-- Execute este script no SQL Editor do Supabase se os dados não
-- estiverem sendo salvos (tenant INSERT retornando erro RLS 42501).
--
-- Causa raiz: tabelas criadas via SQL Editor não herdam os grants
-- automáticos do Supabase para as roles anon e authenticated.
-- ============================================================

-- 1. Garantir acesso ao schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- 2. Grants em todas as tabelas existentes
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants        TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users          TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients        TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cases          TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions   TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks          TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.deadlines      TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hearings       TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events         TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.channels       TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications  TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.publications   TO anon, authenticated;

-- 3. Sequences (necessário para IDs auto-incrementados, se houver)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- 4. Funções auxiliares (get_current_tenant_id, etc.)
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated;

-- 5. Garantir grants automáticos para tabelas futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated;

-- 6. Verificar resultado
SELECT
  grantee,
  table_name,
  string_agg(privilege_type, ', ' ORDER BY privilege_type) AS privileges
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name = 'tenants'
  AND grantee IN ('anon', 'authenticated')
GROUP BY grantee, table_name
ORDER BY grantee;
