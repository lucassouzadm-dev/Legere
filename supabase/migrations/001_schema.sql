-- ============================================================
-- Legere SaaS — Schema Completo v1.0
-- Aplique este arquivo no SQL Editor do seu projeto Supabase.
-- ============================================================

-- ─── Extensões ────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── TABELA: tenants ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tenants (
  id            TEXT        PRIMARY KEY,
  name          TEXT        NOT NULL,
  slogan        TEXT,
  cnpj          TEXT,
  phone         TEXT,
  email         TEXT        NOT NULL UNIQUE,
  plan          TEXT        NOT NULL DEFAULT 'ESSENCIAL',
  logo_url      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active        BOOLEAN     NOT NULL DEFAULT TRUE,
  trial_ends_at TIMESTAMPTZ
);

-- ─── TABELA: users ────────────────────────────────────────────────────────────
-- auth_id referencia auth.users (Supabase Auth).
-- Cada usuário de negócio tem exatamente um auth user correspondente.
CREATE TABLE IF NOT EXISTS public.users (
  id           TEXT        PRIMARY KEY,
  auth_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id    TEXT        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  email        TEXT        NOT NULL,
  role         TEXT        NOT NULL DEFAULT 'LAWYER',
  status       TEXT        NOT NULL DEFAULT 'APPROVED',
  monthly_goal NUMERIC     NOT NULL DEFAULT 0,
  avatar       TEXT,
  oab_number   TEXT,
  oab_state    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_auth_id   ON public.users(auth_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON public.users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email     ON public.users(email);

-- ─── Função auxiliar de isolamento multi-tenant ───────────────────────────────
-- Retorna o tenant_id do usuário autenticado (via JWT → auth.uid()).
-- SECURITY DEFINER: roda como owner (bypassa RLS na tabela users), evitando
-- recursão infinita quando a própria policy de users chama essa função.
CREATE OR REPLACE FUNCTION public.get_current_tenant_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tenant_id FROM public.users WHERE auth_id = auth.uid() LIMIT 1;
$$;

-- ─── Trigger: cria user row automaticamente ao cadastrar no Supabase Auth ─────
-- Metadata esperada em auth.signUp: tenant_id, name, role, oab_number, oab_state
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    id, auth_id, tenant_id, name, email, role, status, monthly_goal
  ) VALUES (
    'u-' || EXTRACT(EPOCH FROM NOW())::BIGINT::TEXT || '-' || gen_random_uuid()::TEXT,
    NEW.id,
    (NEW.raw_user_meta_data->>'tenant_id')::TEXT,
    COALESCE((NEW.raw_user_meta_data->>'name')::TEXT, NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::TEXT, 'LAWYER'),
    'APPROVED',
    0
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- ─── Demais tabelas ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.clients (
  id                TEXT        PRIMARY KEY,
  tenant_id         TEXT        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  type              TEXT        NOT NULL DEFAULT 'PF',
  document          TEXT,
  email             TEXT,
  phone             TEXT,
  status            TEXT        NOT NULL DEFAULT 'ACTIVE',
  created_at        TEXT,
  tags              JSONB       NOT NULL DEFAULT '[]',
  score             NUMERIC     NOT NULL DEFAULT 0,
  birth_date        TEXT,
  last_contact_date TEXT,
  area              TEXT,
  total_contract    NUMERIC     NOT NULL DEFAULT 0,
  total_paid        NUMERIC     NOT NULL DEFAULT 0,
  documents         JSONB       NOT NULL DEFAULT '[]',
  service_logs      JSONB       NOT NULL DEFAULT '[]',
  notices           JSONB       NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS public.cases (
  id                TEXT        PRIMARY KEY,
  tenant_id         TEXT        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cnj               TEXT,
  title             TEXT,
  client_id         TEXT,
  client_name       TEXT,
  area              TEXT,
  court             TEXT,
  status            TEXT        NOT NULL DEFAULT 'ACTIVE',
  lawyer_id         TEXT,
  value             NUMERIC     NOT NULL DEFAULT 0,
  probability       NUMERIC     NOT NULL DEFAULT 50,
  risk              TEXT        NOT NULL DEFAULT 'MEDIUM',
  next_deadline     TEXT,
  created_at        TEXT,
  distribution_date TEXT
);

CREATE TABLE IF NOT EXISTS public.transactions (
  id              TEXT        PRIMARY KEY,
  tenant_id       TEXT        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  description     TEXT        NOT NULL,
  amount          NUMERIC     NOT NULL,
  type            TEXT        NOT NULL,
  category        TEXT,
  date            TEXT,
  status          TEXT        NOT NULL DEFAULT 'PENDING',
  has_attachment  BOOLEAN     NOT NULL DEFAULT FALSE,
  attachment_data TEXT,
  attachment_name TEXT,
  professional_id TEXT,
  client_id       TEXT,
  client_name     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id         TEXT    PRIMARY KEY,
  tenant_id  TEXT    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  client     TEXT,
  priority   TEXT    NOT NULL DEFAULT 'MEDIUM',
  deadline   TEXT,
  status     TEXT    NOT NULL DEFAULT 'TODO',
  responsible TEXT,
  created_by TEXT,
  comments   JSONB   NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS public.deadlines (
  id               TEXT        PRIMARY KEY,
  tenant_id        TEXT        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title            TEXT,
  date             TEXT        NOT NULL,
  case_id          TEXT,
  case_name        TEXT,
  client_id        TEXT,
  client_name      TEXT,
  responsible_id   TEXT,
  responsible_name TEXT,
  priority         TEXT        NOT NULL DEFAULT 'MEDIUM',
  status           TEXT        NOT NULL DEFAULT 'PENDING',
  description      TEXT
);

CREATE TABLE IF NOT EXISTS public.hearings (
  id               TEXT        PRIMARY KEY,
  tenant_id        TEXT        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  date             TEXT        NOT NULL,
  time             TEXT,
  process_number   TEXT,
  parties          TEXT,
  modality         TEXT        NOT NULL DEFAULT 'PRESENCIAL',
  link             TEXT,
  location         TEXT,
  responsible_id   TEXT,
  responsible_name TEXT,
  status           TEXT        NOT NULL DEFAULT 'SCHEDULED',
  notes            TEXT,
  publication_id   TEXT,
  case_id          TEXT,
  client_name      TEXT,
  notified_5d      BOOLEAN     NOT NULL DEFAULT FALSE,
  notified_1d      BOOLEAN     NOT NULL DEFAULT FALSE,
  notified_3h      BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.events (
  id           TEXT        PRIMARY KEY,
  tenant_id    TEXT        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  date         TEXT,
  time         TEXT,
  type         TEXT        NOT NULL DEFAULT 'MEETING',
  description  TEXT,
  participants JSONB       NOT NULL DEFAULT '[]',
  client_id    TEXT,
  case_id      TEXT,
  created_by   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.channels (
  id        TEXT    PRIMARY KEY,
  tenant_id TEXT    NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name      TEXT    NOT NULL,
  members   JSONB   NOT NULL DEFAULT '[]',
  type      TEXT    NOT NULL DEFAULT 'CHANNEL'
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          TEXT        PRIMARY KEY,
  tenant_id   TEXT        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sender_id   TEXT,
  sender_name TEXT,
  content     TEXT        NOT NULL,
  time        TEXT,
  chat_id     TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id           TEXT        PRIMARY KEY,
  tenant_id    TEXT        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  title        TEXT        NOT NULL,
  message      TEXT,
  recipient_id TEXT,
  time         TEXT,
  read         BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.publications (
  id               TEXT        PRIMARY KEY,
  tenant_id        TEXT        NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  djen_id          TEXT,
  process_number   TEXT,
  publication_date TEXT,
  content          TEXT,
  tribunal         TEXT,
  lawyer_oab       TEXT,
  lawyer_name      TEXT,
  lawyer_id        TEXT,
  case_id          TEXT,
  status           TEXT        NOT NULL DEFAULT 'unread',
  deadline_created BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- Política padrão: cada tabela visível apenas para usuários do mesmo tenant.

ALTER TABLE public.tenants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cases        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deadlines    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hearings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channels     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.publications  ENABLE ROW LEVEL SECURITY;

-- tenants: leitura própria + INSERT público (criação de conta)
CREATE POLICY "tenants_select" ON public.tenants
  FOR SELECT USING (id = public.get_current_tenant_id());
CREATE POLICY "tenants_insert" ON public.tenants
  FOR INSERT WITH CHECK (TRUE);   -- qualquer um pode registrar seu escritório
CREATE POLICY "tenants_update" ON public.tenants
  FOR UPDATE USING (id = public.get_current_tenant_id());

-- users: isolamento por tenant; INSERT livre para trigger de auth
CREATE POLICY "users_select" ON public.users
  FOR SELECT USING (tenant_id = public.get_current_tenant_id() OR auth_id = auth.uid());
CREATE POLICY "users_insert" ON public.users
  FOR INSERT WITH CHECK (TRUE);   -- trigger de auth precisa inserir como SECURITY DEFINER
CREATE POLICY "users_update" ON public.users
  FOR UPDATE USING (tenant_id = public.get_current_tenant_id());
CREATE POLICY "users_delete" ON public.users
  FOR DELETE USING (tenant_id = public.get_current_tenant_id());

-- Macro para gerar policies idênticas nas demais tabelas
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'clients','cases','transactions','tasks','deadlines',
    'hearings','events','channels','chat_messages','notifications','publications'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY %I ON public.%I USING (tenant_id = public.get_current_tenant_id())',
      tbl || '_tenant_isolation', tbl
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (tenant_id = public.get_current_tenant_id())',
      tbl || '_tenant_insert', tbl
    );
  END LOOP;
END;
$$;

-- ─── Índices de performance ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_clients_tenant      ON public.clients(tenant_id);
CREATE INDEX IF NOT EXISTS idx_cases_tenant        ON public.cases(tenant_id);
CREATE INDEX IF NOT EXISTS idx_transactions_tenant ON public.transactions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant        ON public.tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deadlines_tenant    ON public.deadlines(tenant_id);
CREATE INDEX IF NOT EXISTS idx_hearings_tenant     ON public.hearings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_tenant       ON public.events(tenant_id);
CREATE INDEX IF NOT EXISTS idx_publications_tenant ON public.publications(tenant_id);
CREATE INDEX IF NOT EXISTS idx_chat_tenant_time    ON public.chat_messages(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notif_recipient     ON public.notifications(tenant_id, recipient_id, read);
