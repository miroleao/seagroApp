-- ============================================================
-- Controle manual de parcelas pagas / recebidas
-- ============================================================
-- CONTEXTO
--   O financeiro estimava parcelas pagas por tempo decorrido
--   (1 parcela a cada 30 dias desde a data da transação), ignorando
--   a tabela `installments`. Não havia como corrigir na mão.
--
-- NOVA REGRA DE PRECEDÊNCIA (aplicada no código):
--   1º  transactions.parcelas_pagas_manual  — se preenchido, manda
--   2º  COUNT(installments WHERE status = 'PAGO')
--   3º  fallback antigo por tempo decorrido
--
--   parcelas_pagas_manual = NULL  → volta ao cálculo automático
--   parcelas_pagas_manual = 0     → zero parcelas pagas (explícito)
--
-- Rodar no Supabase SQL Editor.
-- ============================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS parcelas_pagas_manual INTEGER;

ALTER TABLE transactions
  DROP CONSTRAINT IF EXISTS transactions_parcelas_pagas_manual_check;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_parcelas_pagas_manual_check
  CHECK (parcelas_pagas_manual IS NULL OR parcelas_pagas_manual >= 0);

COMMENT ON COLUMN transactions.parcelas_pagas_manual IS
  'Quantidade de parcelas efetivamente pagas/recebidas, informada manualmente. '
  'NULL = usar cálculo automático (installments PAGO, ou tempo decorrido).';

-- Índice para os agregados do dashboard financeiro
CREATE INDEX IF NOT EXISTS transactions_farm_tipo_idx
  ON transactions (farm_id, tipo);

-- ── Conferência ──────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable
FROM   information_schema.columns
WHERE  table_name = 'transactions'
  AND  column_name = 'parcelas_pagas_manual';
