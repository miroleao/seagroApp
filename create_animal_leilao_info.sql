-- ─── Migração: animal_leilao_info (completa) ────────────────────────────────
-- Rode este arquivo no Supabase SQL Editor.
-- É seguro rodar mesmo que a tabela já exista (usa IF NOT EXISTS em tudo).

-- 1. Cria a tabela se não existir
CREATE TABLE IF NOT EXISTS animal_leilao_info (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id              TEXT        NOT NULL,
  animal_id            UUID        NOT NULL REFERENCES animals(id) ON DELETE CASCADE,

  convite_nome         TEXT,
  convite_data         DATE,
  convite_promotores   TEXT,

  compra_leilao_nome   TEXT,
  compra_leilao_data   DATE,
  compra_valor_parcela NUMERIC(12, 2),

  meta_valor_parcela   NUMERIC(12, 2),

  venda_comprador      TEXT,
  venda_valor_parcela  NUMERIC(12, 2),
  venda_n_parcelas     INTEGER,

  criado_em            TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em        TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Garante as colunas de venda (caso a tabela exista mas sem essas colunas)
ALTER TABLE animal_leilao_info ADD COLUMN IF NOT EXISTS venda_comprador     TEXT;
ALTER TABLE animal_leilao_info ADD COLUMN IF NOT EXISTS venda_valor_parcela NUMERIC(12, 2);
ALTER TABLE animal_leilao_info ADD COLUMN IF NOT EXISTS venda_n_parcelas    INTEGER;
ALTER TABLE animal_leilao_info ADD COLUMN IF NOT EXISTS meta_valor_parcela  NUMERIC(12, 2);

-- 3. Desliga RLS (o app usa service_role key, que bypassa RLS de qualquer forma)
ALTER TABLE animal_leilao_info DISABLE ROW LEVEL SECURITY;

-- 4. Índice para buscas por animal
CREATE INDEX IF NOT EXISTS idx_animal_leilao_info_animal_id
  ON animal_leilao_info (animal_id);

-- 5. Verificação: mostra quantas linhas existem
SELECT COUNT(*) AS total_linhas FROM animal_leilao_info;
