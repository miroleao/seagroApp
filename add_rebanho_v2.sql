-- ============================================================
-- Migração v2: Gestão de Rebanho
-- SE Agropecuária Nelore de Elite
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Novos campos na tabela animals
ALTER TABLE animals ADD COLUMN IF NOT EXISTS classificacao   TEXT;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS data_entrada    DATE;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS forma_entrada   TEXT;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS status_rebanho  TEXT;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS peso_atual      NUMERIC(7,2);

-- 2. Constraints (drop e recria para idempotência)
ALTER TABLE animals DROP CONSTRAINT IF EXISTS animals_classificacao_check;
ALTER TABLE animals ADD CONSTRAINT animals_classificacao_check
  CHECK (classificacao IN ('RECEPTORA','RECRIA','DESCARTE','OUTRO'));

ALTER TABLE animals DROP CONSTRAINT IF EXISTS animals_forma_entrada_check;
ALTER TABLE animals ADD CONSTRAINT animals_forma_entrada_check
  CHECK (forma_entrada IN ('COMPRA','EMPRESTIMO','PROPRIO','DOACAO','OUTRO'));

ALTER TABLE animals DROP CONSTRAINT IF EXISTS animals_status_rebanho_check;
ALTER TABLE animals ADD CONSTRAINT animals_status_rebanho_check
  CHECK (status_rebanho IN (
    'PROTOCOLADA','INSEMINADA','IMPLANTADA',
    'PRENHA','PRENHA_EMBRIAO',
    'VAZIA','DESCARTE'
  ));

-- 3. Preencher classificacao para animais já existentes (retroativo)
UPDATE animals SET classificacao = 'RECEPTORA'
  WHERE tipo = 'RECEPTORA' AND classificacao IS NULL;

UPDATE animals SET classificacao = 'DESCARTE'
  WHERE tipo = 'DESCARTE' AND classificacao IS NULL;

-- 4. Tabela de pesagens
CREATE TABLE IF NOT EXISTS pesagens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id     UUID NOT NULL REFERENCES farms(id)   ON DELETE CASCADE,
  animal_id   UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  data        DATE NOT NULL,
  peso_kg     NUMERIC(7,2) NOT NULL,
  observacoes TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pesagens_animal_idx ON pesagens(animal_id, data DESC);
CREATE INDEX IF NOT EXISTS pesagens_farm_idx   ON pesagens(farm_id);

COMMENT ON TABLE  pesagens               IS 'Histórico de pesagens dos animais do rebanho.';
COMMENT ON COLUMN pesagens.data          IS 'Data em que a pesagem foi realizada.';
COMMENT ON COLUMN pesagens.peso_kg       IS 'Peso do animal em quilogramas.';
COMMENT ON COLUMN animals.classificacao  IS 'Classificação dentro do rebanho: RECEPTORA | RECRIA | DESCARTE | OUTRO.';
COMMENT ON COLUMN animals.data_entrada   IS 'Data em que o animal entrou na fazenda.';
COMMENT ON COLUMN animals.forma_entrada  IS 'Como o animal entrou: COMPRA | EMPRESTIMO | PROPRIO | DOACAO | OUTRO.';
COMMENT ON COLUMN animals.status_rebanho IS 'Status reprodutivo específico do rebanho.';
