-- ============================================================
-- Transações sem data — diagnóstico e recuperação
-- ============================================================
--   Sem `transactions.data`, o financeiro não estima parcelas pagas
--   e mostra saldo devedor integral.
--
--   MAS: o app já usa `auctions.data` como fallback. Transação ligada
--   a um leilão datado NÃO está cega, mesmo com `data` nula.
--
--   Passos 1 e 2 são só leitura. O 3 altera dados (com backup).
-- ============================================================


-- ─── PASSO 1 — Quanto está realmente cego ────────────────────────────────────

SELECT
  CASE
    WHEN t.data IS NOT NULL              THEN '1. OK — tem data própria'
    WHEN au.data IS NOT NULL             THEN '2. OK — herda data do leilão'
    WHEN t.auction_id IS NOT NULL        THEN '3. CEGO — leilão vinculado, mas sem data'
    ELSE                                      '4. CEGO — sem data e sem leilão'
  END                       AS situacao,
  COUNT(*)                  AS lancamentos,
  SUM(t.valor_total)        AS valor_total
FROM   transactions t
LEFT   JOIN auctions au ON au.id = t.auction_id
GROUP  BY 1
ORDER  BY 1;


-- ─── PASSO 2 — Detalhe dos que herdam data do leilão ─────────────────────────
--   Esses já funcionam. Preencher `transactions.data` deixa o dado explícito
--   e protege caso o leilão seja editado depois.

SELECT t.id, t.tipo, t.animal_nome, t.valor_total, t.n_parcelas,
       au.nome AS leilao, au.data AS data_do_leilao
FROM   transactions t
JOIN   auctions au ON au.id = t.auction_id
WHERE  t.data IS NULL
  AND  au.data IS NOT NULL
ORDER  BY au.data DESC;


-- ─── PASSO 3 — Copiar a data do leilão para a transação ──────────────────────
--   Descomente e rode. Cria backup antes.

/*
CREATE TABLE IF NOT EXISTS transactions_backup_datas AS
SELECT id, data, auction_id FROM transactions;

BEGIN;

UPDATE transactions t
SET    data = au.data
FROM   auctions au
WHERE  au.id = t.auction_id
  AND  t.data IS NULL
  AND  au.data IS NOT NULL;

COMMIT;

-- Restaurar, se precisar:
-- UPDATE transactions t SET data = b.data
-- FROM transactions_backup_datas b WHERE b.id = t.id;
*/


-- ─── PASSO 4 — O que sobra: preenchimento manual ─────────────────────────────
--   Sem leilão e sem data, não há de onde inferir. `criado_em` é a data em que
--   o registro foi digitado no sistema, não a data da compra — serve só como
--   pista de ordem cronológica.
--
--   Duas saídas, ambas pela tela:
--     a) preencher a data no botão de editar a transação  → estimativa volta
--     b) informar as parcelas pagas na coluna Parcelas    → trava o número real
--
--   Opção (b) é mais precisa: não depende de a compra ter sido mensal exata.

SELECT t.id,
       t.tipo,
       t.animal_nome,
       t.contraparte,
       t.valor_total,
       t.n_parcelas,
       ROUND(t.valor_total / NULLIF(t.n_parcelas, 0), 2) AS valor_parcela,
       t.parcelas_pagas_manual,
       t.criado_em::DATE                                 AS digitado_em,
       t.observacoes
FROM   transactions t
LEFT   JOIN auctions au ON au.id = t.auction_id
WHERE  t.data IS NULL
  AND  au.data IS NULL
ORDER  BY t.valor_total DESC;


-- ─── PASSO 5 — Template para preencher em massa (opcional) ───────────────────
--   Se você souber as datas, edite a lista abaixo e rode. Cada linha é
--   um id de transação e a data real da compra/venda.

/*
BEGIN;

UPDATE transactions AS t
SET    data = v.data_real::DATE
FROM  (VALUES
  ('00000000-0000-0000-0000-000000000000'::UUID, '2025-03-15'),
  ('00000000-0000-0000-0000-000000000000'::UUID, '2025-06-20')
  -- adicione as demais linhas aqui
) AS v(id, data_real)
WHERE t.id = v.id;

COMMIT;
*/


-- ─── Conferência final ───────────────────────────────────────────────────────
SELECT COUNT(*)         AS ainda_cegos,
       SUM(valor_total) AS valor_cego
FROM   transactions t
LEFT   JOIN auctions au ON au.id = t.auction_id
WHERE  t.data IS NULL AND au.data IS NULL;
