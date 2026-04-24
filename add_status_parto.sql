-- ============================================================
-- Migração: novos status reprodutivos + rastreamento de partos
-- ============================================================

-- 1. Remove constraint antiga e recria com PARIDA e ABORTOU
ALTER TABLE animals DROP CONSTRAINT IF EXISTS animals_status_reprodutivo_check;

ALTER TABLE animals
  ADD CONSTRAINT animals_status_reprodutivo_check
  CHECK (status_reprodutivo IN (
    'COLETANDO', 'INSEMINADA', 'GESTANTE',
    'VAZIA', 'SECA', 'DESCARTADA', 'VENDIDA',
    'PARIDA', 'ABORTOU'
  ));

-- 2. Data do evento do status atual (data do parto, da inseminação, etc.)
ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS data_status DATE;

-- 3. Rastreamento de partos
ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS numero_partos       INTEGER NOT NULL DEFAULT 0;

ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS data_primeiro_parto DATE;

ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS data_ultimo_parto   DATE;

COMMENT ON COLUMN animals.data_status          IS 'Data do evento associado ao status_reprodutivo atual (parto, inseminação, etc.)';
COMMENT ON COLUMN animals.numero_partos        IS 'Número total de partos registrados para este animal.';
COMMENT ON COLUMN animals.data_primeiro_parto  IS 'Data do primeiro parto (calculada automaticamente ao registrar PARIDA pela 1ª vez).';
COMMENT ON COLUMN animals.data_ultimo_parto    IS 'Data do parto mais recente.';
