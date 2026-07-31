-- ============================================================
-- Backfill / sincronização de vínculos financeiro ↔ animal
-- ============================================================
-- CONTEXTO
--   `criarTransacao` gravava apenas transactions.doadora_id.
--   Nunca escrevia em `transaction_animals` nem em `transactions.animal_id`.
--   Consequência: a ficha do rebanho (que consulta por animal_id) nunca
--   mostrava lançamento nenhum, e as fichas de touro dependiam de sorte.
--
--   O código passa a gravar `transaction_animals` na criação. Este script
--   conserta o histórico.
--
-- Pré-requisito: create_transaction_animals.sql já rodado.
-- Rodar no Supabase SQL Editor.
-- ============================================================

BEGIN;

-- ── 1. Garante a tabela junction ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transaction_animals (
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  animal_id      UUID NOT NULL REFERENCES animals(id)      ON DELETE CASCADE,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (transaction_id, animal_id)
);

CREATE INDEX IF NOT EXISTS idx_transaction_animals_tx     ON transaction_animals(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_animals_animal ON transaction_animals(animal_id);

-- ── 2. Backfill a partir de doadora_id ───────────────────────────────────────
INSERT INTO transaction_animals (transaction_id, animal_id)
SELECT t.id, t.doadora_id
FROM   transactions t
WHERE  t.doadora_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── 3. Backfill a partir de animal_id (coluna legada) ────────────────────────
INSERT INTO transaction_animals (transaction_id, animal_id)
SELECT t.id, t.animal_id
FROM   transactions t
WHERE  t.animal_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── 4. Backfill por nome exato ───────────────────────────────────────────────
--   Só vincula quando o nome do animal na transação bate EXATAMENTE com
--   um único animal cadastrado (ignorando os prefixos "Prenhez " / "Aspiração ").
--   Casos ambíguos ficam de fora de propósito — melhor não vincular do que
--   vincular errado.
INSERT INTO transaction_animals (transaction_id, animal_id)
SELECT t.id, a.id
FROM   transactions t
JOIN   animals a
  ON   a.farm_id = t.farm_id
 AND   LOWER(TRIM(a.nome)) = LOWER(TRIM(
         REGEXP_REPLACE(t.animal_nome, '^(Prenhez|Aspiração)\s+', '')
       ))
WHERE  t.animal_nome IS NOT NULL
  AND  TRIM(t.animal_nome) <> ''
  AND  NOT EXISTS (
         SELECT 1 FROM transaction_animals ta WHERE ta.transaction_id = t.id
       )
  -- garante que o nome resolve para UM único animal
  AND (
        SELECT COUNT(*)
        FROM   animals a2
        WHERE  a2.farm_id = t.farm_id
          AND  LOWER(TRIM(a2.nome)) = LOWER(TRIM(
                 REGEXP_REPLACE(t.animal_nome, '^(Prenhez|Aspiração)\s+', '')
               ))
      ) = 1
ON CONFLICT DO NOTHING;

-- ── 5. Sincroniza as colunas legadas com o vínculo principal ─────────────────
UPDATE transactions t
SET    doadora_id = sub.animal_id
FROM (
  SELECT DISTINCT ON (transaction_id) transaction_id, animal_id
  FROM   transaction_animals
  ORDER  BY transaction_id, criado_em
) sub
WHERE t.id = sub.transaction_id
  AND t.doadora_id IS NULL;

UPDATE transactions t
SET    animal_id = t.doadora_id
WHERE  t.animal_id IS NULL
  AND  t.doadora_id IS NOT NULL;

COMMIT;

-- ── 6. Conferência ───────────────────────────────────────────────────────────
SELECT 'transações totais'          AS metrica, COUNT(*)::TEXT AS valor FROM transactions
UNION ALL
SELECT 'transações com vínculo',    COUNT(DISTINCT transaction_id)::TEXT FROM transaction_animals
UNION ALL
SELECT 'transações SEM vínculo',    COUNT(*)::TEXT
FROM   transactions t
WHERE  NOT EXISTS (SELECT 1 FROM transaction_animals ta WHERE ta.transaction_id = t.id);

-- Lista o que ficou sem vínculo, para você resolver na tela (coluna "Vínculo")
SELECT id, tipo, animal_nome, contraparte, valor_total, data
FROM   transactions t
WHERE  NOT EXISTS (SELECT 1 FROM transaction_animals ta WHERE ta.transaction_id = t.id)
ORDER  BY data DESC NULLS LAST;
