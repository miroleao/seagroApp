-- Migration: colunas faltando para o fluxo OPU completo
-- Rodar no Supabase SQL Editor

-- Campos de embriões por tipo de congelamento em aspirations
ALTER TABLE aspirations
  ADD COLUMN IF NOT EXISTS embrioes_dt          integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embrioes_vitrificados integer DEFAULT 0;

-- Tipo de congelamento em embryos (DT = Direto, VITRIFICADO)
ALTER TABLE embryos
  ADD COLUMN IF NOT EXISTS tipo_congelamento text;
