-- ══════════════════════════════════════════════════════════════════════════════
-- FIX: Corrigir valor_total das transações financeiras
-- Problema: valor_total foi salvo como valor_parcela em muitas transações
-- Solução: valor_total = valor_parcela × n_parcelas
-- Data: 2026-05-30
-- ══════════════════════════════════════════════════════════════════════════════

-- PASSO 1: DIAGNÓSTICO — rode isso primeiro e revise os resultados
-- Ver transações onde valor_total ≠ valor_parcela × n_parcelas

SELECT
  t.id,
  t.tipo,
  t.categoria,
  t.animal_nome,
  t.valor_total          AS total_no_banco,
  t.n_parcelas,
  i.valor                AS valor_por_parcela,
  ROUND(i.valor::numeric * t.n_parcelas, 2) AS total_correto,
  ROUND(i.valor::numeric * t.n_parcelas - t.valor_total, 2) AS diferenca
FROM transactions t
LEFT JOIN LATERAL (
  SELECT valor FROM installments
  WHERE transaction_id = t.id
  ORDER BY numero
  LIMIT 1
) i ON true
WHERE t.farm_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  AND i.valor IS NOT NULL
  AND t.n_parcelas > 1
  AND ABS(ROUND(i.valor::numeric * t.n_parcelas, 2) - t.valor_total) > 0.01
ORDER BY diferenca DESC;


-- PASSO 2: Transações SEM installments registrados (fixes separados via form)

SELECT
  t.id,
  t.tipo,
  t.animal_nome,
  t.valor_total,
  t.n_parcelas
FROM transactions t
WHERE t.farm_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  AND t.n_parcelas > 1
  AND NOT EXISTS (
    SELECT 1 FROM installments WHERE transaction_id = t.id
  )
ORDER BY t.data DESC;


-- ══════════════════════════════════════════════════════════════════════════════
-- PASSO 3: CORRIGIR (só rode após revisar os resultados acima!)
-- Atualiza valor_total = valor_parcela × n_parcelas
-- Afeta SOMENTE transações com installments existentes e discrepância detectada
-- ══════════════════════════════════════════════════════════════════════════════

UPDATE transactions t
SET valor_total = ROUND(
  (SELECT valor FROM installments WHERE transaction_id = t.id ORDER BY numero LIMIT 1)::numeric
  * t.n_parcelas,
  2
)
WHERE t.farm_id = 'aaaaaaaa-0000-0000-0000-000000000001'
  AND t.n_parcelas > 1
  AND EXISTS (SELECT 1 FROM installments WHERE transaction_id = t.id)
  AND ABS(
    t.valor_total -
    ROUND(
      (SELECT valor FROM installments WHERE transaction_id = t.id ORDER BY numero LIMIT 1)::numeric
      * t.n_parcelas,
      2
    )
  ) > 0.01
RETURNING
  t.id,
  t.animal_nome,
  t.valor_total AS novo_total,
  t.n_parcelas;
