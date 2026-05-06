-- Migration: mae_id em animals + tipo_desfecho em pregnancy_diagnoses
-- Rodar no Supabase SQL Editor

-- Link direto para a mãe (doadora cadastrada) no animal
ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS mae_id uuid REFERENCES animals(id) ON DELETE SET NULL;

-- Tipo do desfecho (PARIDA, ABORTOU, REABSORVEU, OBITO, VENDA) em pregnancy_diagnoses
ALTER TABLE pregnancy_diagnoses
  ADD COLUMN IF NOT EXISTS tipo_desfecho text;
