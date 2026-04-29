-- ============================================================
-- Legere SaaS — Migração Supabase (multi-tenancy)
-- ============================================================
-- Execute este script no SQL Editor do seu projeto Supabase.
-- Ele cria a tabela `tenants` e adiciona a coluna `tenant_id`
-- em todas as tabelas existentes para isolamento total dos dados.
-- ============================================================

-- ─── Tabela de Tenants (escritórios contratantes) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.tenants (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  cnpj          TEXT,
  phone         TEXT,
  email         TEXT NOT NULL UNIQUE,
  plan          TEXT NOT NULL DEFAULT 'ESSENCIAL',
  logo_url      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  active        BOOLEAN NOT NULL DEFAULT true,
  trial_ends_at TIMESTAMPTZ
);

-- ─── Adicionar tenant_id em todas as tabelas ─────────────────────────────────

ALTER TABLE public.users         ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES public.tenants(id);
ALTER TABLE public.clients       ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES public.tenants(id);
ALTER TABLE public.cases         ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES public.tenants(id);
ALTER TABLE public.transactions  ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES public.tenants(id);
ALTER TABLE public.tasks         ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES public.tenants(id);
ALTER TABLE public.deadlines     ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES public.tenants(id);
ALTER TABLE public.hearings      ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES public.tenants(id);
ALTER TABLE public.events        ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES public.tenants(id);
ALTER TABLE public.channels      ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES public.tenants(id);
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES public.tenants(id);
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS tenant_id TEXT REFERENCES public.tenants(id);

-- ─── Tabela de Publicações DJEN (se não existir) ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.publications (
  id                TEXT PRIMARY KEY,
  djen_id           TEXT,
  process_number    TEXT,
  publication_date  DATE,
  content           TEXT,
  tribunal          TEXT,
  lawyer_oab        TEXT,
  lawyer_name       TEXT,
  lawyer_id         TEXT,
  case_id           TEXT,
  status            TEXT NOT NULL DEFAULT 'unread',
  deadline_created  BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  tenant_id         TEXT REFERENCES public.tenants(id)
);

-- ─── Índices para performance ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_tenant         ON public.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_clients_tenant       ON public.clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cases_tenant         ON public.cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant  ON public.transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant         ON public.tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_tenant     ON public.deadlines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hearings_tenant      ON public.hearings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_tenant        ON public.events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_channels_tenant      ON public.channels(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_tenant ON public.chat_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON public.notifications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_publications_tenant  ON public.publications(tenant_id);

-- ─── Row Level Security (RLS) — Isolamento total por tenant ──────────────────
-- ATENÇÃO: Adapte conforme seu mecanismo de autenticação Supabase.
-- Se estiver usando somente a anon key (sem Supabase Auth), mantenha RLS
-- desabilitado e controle o isolamento via application layer (já implementado).

-- Exemplo com Supabase Auth (opcional):
-- ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "tenant_isolation" ON public.users
--   USING (tenant_id = current_setting('app.tenant_id', true));

-- ─── Permissões ───────────────────────────────────────────────────────────────

GRANT ALL ON public.tenants      TO anon, authenticated;
GRANT ALL ON public.publications TO anon, authenticated;

-- ============================================================
-- Após executar, configure no .env:
--   VITE_SUPABASE_URL=https://SEU_PROJETO.supabase.co
--   VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON
--   GEMINI_API_KEY=SUA_CHAVE_GEMINI
-- ============================================================
