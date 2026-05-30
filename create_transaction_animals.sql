-- ============================================================================
-- Tabela: transaction_animals
-- Permite vincular uma transação (compra/venda) a múltiplos animais.
-- Mantém `transactions.doadora_id` como vínculo principal (compatibilidade).
-- ============================================================================

CREATE TABLE IF NOT EXISTS transaction_animals (
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  animal_id      UUID NOT NULL REFERENCES animals(id)      ON DELETE CASCADE,
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (transaction_id, animal_id)
);

CREATE INDEX IF NOT EXISTS idx_transaction_animals_tx     ON transaction_animals(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_animals_animal ON transaction_animals(animal_id);

-- Backfill: para transações que já têm doadora_id, cria o link na tabela junction
INSERT INTO transaction_animals (transaction_id, animal_id)
SELECT id, doadora_id
FROM transactions
WHERE doadora_id IS NOT NULL
ON CONFLICT DO NOTHING;
