-- ============================================================
-- Migration 004 — Cria bucket "attachments" no Supabase Storage
-- Execute no SQL Editor do Supabase.
-- ============================================================

-- 1. Criar o bucket (público)
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Política: upload para usuários autenticados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Authenticated upload'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Authenticated upload"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'attachments')
    $p$;
  END IF;
END $$;

-- 3. Política: leitura pública
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Public read attachments'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Public read attachments"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'attachments')
    $p$;
  END IF;
END $$;

-- 4. Política: delete para usuários autenticados
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename  = 'objects'
      AND policyname = 'Authenticated delete'
  ) THEN
    EXECUTE $p$
      CREATE POLICY "Authenticated delete"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (bucket_id = 'attachments')
    $p$;
  END IF;
END $$;
