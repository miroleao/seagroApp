-- ────────────────────────────────────────────────────────────────────────────
-- Migration: adiciona doadora_id em transactions
-- Execute no Supabase SQL Editor
-- ────────────────────────────────────────────────────────────────────────────

-- 1. Adiciona a coluna (nullable — retrocompatível com registros existentes)
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS doadora_id UUID REFERENCES animals(id) ON DELETE SET NULL;

-- 2. Índice para acelerar as buscas por doadora
CREATE INDEX IF NOT EXISTS transactions_doadora_id_idx ON transactions(doadora_id);

-- 3. (Opcional) Tenta backfill automático dos registros existentes:
--    encontra animals cujo nome aparece dentro do animal_nome da transação
--    e preenche doadora_id. Revise antes de rodar.
UPDATE transactions t
SET doadora_id = a.id
FROM animals a
WHERE t.doadora_id IS NULL
  AND a.tipo = 'DOADORA'
  AND t.animal_nome ILIKE '%' || a.nome || '%';
