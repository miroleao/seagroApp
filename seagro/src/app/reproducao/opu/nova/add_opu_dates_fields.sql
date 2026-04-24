-- Migration: novos campos para sessão OPU e aspirações
-- Rodar no Supabase SQL Editor

-- Datas adicionais na sessão OPU
ALTER TABLE opu_sessions
  ADD COLUMN IF NOT EXISTS data_fiv      date,
  ADD COLUMN IF NOT EXISTS data_dg       date,
  ADD COLUMN IF NOT EXISTS data_sexagem  date;

-- Campos adicionais nas aspirações
ALTER TABLE aspirations
  ADD COLUMN IF NOT EXISTS doadora_rgn      text,
  ADD COLUMN IF NOT EXISTS touro_rgn        text,
  ADD COLUMN IF NOT EXISTS implantados      integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prenhezes_count  integer DEFAULT 0;
