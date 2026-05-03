-- ============================================================
-- Migration 003 — Adiciona coluna opposing_party em cases
-- Execute no SQL Editor do Supabase.
-- ============================================================

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS opposing_party TEXT;
