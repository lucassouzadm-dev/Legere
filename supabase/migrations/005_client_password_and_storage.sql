-- ============================================================
-- Migration 005 — Senha hash no Portal do Cliente + Storage anon
-- Execute no SQL Editor do Supabase.
-- ============================================================

-- 1. Adicionar coluna password_hash na tabela clients
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. Permitir upload anônimo no bucket "attachments"
--    (necessário para clientes do portal que não têm Supabase Auth)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Anon upload attachments'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Anon upload attachments"
        ON storage.objects FOR INSERT
        TO anon
        WITH CHECK (bucket_id = 'attachments')
    $p$;
  END IF;
END $$;
