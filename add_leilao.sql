-- ─── Migração: Feature "Para Leilão" ────────────────────────────────────────
-- Rodar no Supabase SQL Editor

-- 1. Flag na tabela de animais
ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS para_leilao BOOLEAN DEFAULT FALSE;

-- 2. Tabela de informações de leilão por animal (1 linha por animal, upsert)
CREATE TABLE IF NOT EXISTS animal_leilao_info (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id              TEXT        NOT NULL,
  animal_id            UUID        NOT NULL REFERENCES animals(id) ON DELETE CASCADE,

  -- Convite (leilão para o qual o animal está sendo preparado)
  convite_nome         TEXT,
  convite_data         DATE,
  convite_promotores   TEXT,

  -- Leilão onde o animal foi comprado
  compra_leilao_nome   TEXT,
  compra_leilao_data   DATE,
  compra_valor_parcela NUMERIC(12, 2),

  -- Meta de valor de venda
  meta_valor_parcela   NUMERIC(12, 2),

  criado_em            TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em        TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (animal_id, farm_id)
);

-- 3. RLS
ALTER TABLE animal_leilao_info ENABLE ROW LEVEL SECURITY;

-- Policy: acesso somente pela farm_id configurada na sessão
-- (mesmo padrão das demais tabelas do projeto)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'animal_leilao_info' AND policyname = 'farm_isolation'
  ) THEN
    CREATE POLICY farm_isolation ON animal_leilao_info
      USING (farm_id = current_setting('app.farm_id', true));
  END IF;
END $$;

-- 4. Índice para buscas por animal
CREATE INDEX IF NOT EXISTS idx_animal_leilao_info_animal_id
  ON animal_leilao_info (animal_id);
