-- =====================================================================
-- add_congelamento.sql
-- SE Agropecuária — Feature: tipo de congelamento (DT / Vitrificado)
-- + garante colunas necessárias que podem estar faltando
-- Execute UMA ÚNICA VEZ no Supabase SQL Editor
-- Seguro: usa IF NOT EXISTS
-- =====================================================================

-- 1. opu_sessions — colunas de datas (caso fix_all não tenha rodado)
ALTER TABLE opu_sessions
  ADD COLUMN IF NOT EXISTS data_fiv     DATE,
  ADD COLUMN IF NOT EXISTS data_dg      DATE,
  ADD COLUMN IF NOT EXISTS data_sexagem DATE;

-- 2. aspirations — colunas extras (caso fix_all não tenha rodado)
ALTER TABLE aspirations
  ADD COLUMN IF NOT EXISTS doadora_rgn       TEXT,
  ADD COLUMN IF NOT EXISTS touro_rgn         TEXT,
  ADD COLUMN IF NOT EXISTS implantados       INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prenhezes_count   INTEGER DEFAULT 0;

-- 3. aspirations — colunas de breakdown DT vs Vitrificado
ALTER TABLE aspirations
  ADD COLUMN IF NOT EXISTS embrioes_dt           INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embrioes_vitrificados INTEGER DEFAULT 0;

-- 4. embryos — tipo de congelamento
ALTER TABLE embryos
  ADD COLUMN IF NOT EXISTS tipo_congelamento TEXT;

ALTER TABLE embryos
  DROP CONSTRAINT IF EXISTS embryos_tipo_congelamento_check;

ALTER TABLE embryos
  ADD CONSTRAINT embryos_tipo_congelamento_check
  CHECK (tipo_congelamento IN ('DT', 'VITRIFICADO'));

-- ── Verificação final ────────────────────────────────────────────────
SELECT
  table_name,
  column_name,
  data_type,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'embryos'      AND column_name = 'tipo_congelamento')
    OR (table_name = 'aspirations' AND column_name IN (
          'embrioes_dt', 'embrioes_vitrificados',
          'doadora_rgn', 'touro_rgn', 'implantados', 'prenhezes_count'))
    OR (table_name = 'opu_sessions' AND column_name IN (
          'data_fiv', 'data_dg', 'data_sexagem'))
  )
ORDER BY table_name, column_name;
