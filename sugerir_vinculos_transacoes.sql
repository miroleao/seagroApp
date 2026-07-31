-- ============================================================
-- Sugestão de vínculos para transações órfãs   (SÓ LEITURA)
-- ============================================================
--   Nenhuma linha é alterada. Este script apenas sugere qual animal
--   cadastrado pode corresponder a cada transação sem vínculo, para
--   você confirmar na coluna "Vínculo" da tela do Financeiro.
--
--   Rodar depois de backfill_transaction_animals.sql.
-- ============================================================


-- ─── CONSULTA 1 — Candidatos por nome limpo ──────────────────────────────────
--   Remove do animal_nome: prefixos "Prenhez "/"Aspiração " e qualquer
--   parêntese no fim — "(100%)", "(50%)", "(2 femeas)", "(02 fêmeas)".
--   Depois procura animais cadastrados com esse nome.
--
--   Leia a coluna `confianca`:
--     EXATO     → nome limpo bate 100%. Pode vincular sem medo.
--     PARCIAL   → um contém o outro. Confira antes.
--     AMBIGUO   → mais de um animal bate. Escolha na tela.

WITH orfas AS (
  SELECT t.id,
         t.tipo,
         t.animal_nome,
         t.contraparte,
         t.valor_total,
         t.data,
         TRIM(REGEXP_REPLACE(
           REGEXP_REPLACE(t.animal_nome, '^(Prenhez|Aspiração)\s+', '', 'i'),
           '\s*\([^)]*\)\s*$', '', 'g'
         )) AS nome_limpo,
         t.farm_id
  FROM   transactions t
  WHERE  NOT EXISTS (
           SELECT 1 FROM transaction_animals ta WHERE ta.transaction_id = t.id
         )
    AND  t.animal_nome IS NOT NULL
    AND  TRIM(t.animal_nome) <> ''
)
SELECT o.id                AS transaction_id,
       o.animal_nome,
       o.nome_limpo,
       o.tipo,
       o.valor_total,
       o.data,
       a.id                AS candidato_id,
       a.nome              AS candidato_nome,
       a.rgn               AS candidato_rgn,
       a.tipo              AS candidato_tipo,
       CASE
         WHEN LOWER(a.nome) = LOWER(o.nome_limpo) THEN 'EXATO'
         ELSE 'PARCIAL'
       END                 AS confianca,
       COUNT(*) OVER (PARTITION BY o.id) AS qtd_candidatos
FROM   orfas o
JOIN   animals a
  ON   a.farm_id = o.farm_id
 AND   ( LOWER(a.nome) = LOWER(o.nome_limpo)
      OR LOWER(a.nome) LIKE '%' || LOWER(o.nome_limpo) || '%'
      OR LOWER(o.nome_limpo) LIKE '%' || LOWER(a.nome) || '%' )
ORDER  BY confianca, o.animal_nome, a.nome;


-- ─── CONSULTA 2 — Órfãs sem nenhum candidato ─────────────────────────────────
--   Aqui entram compras que não são animais (oócitos, sêmen) e prenhezes
--   compradas cuja cria nasceu com outro nome. Vínculo manual ou nenhum.

WITH orfas AS (
  SELECT t.id, t.tipo, t.animal_nome, t.contraparte, t.valor_total, t.data, t.farm_id,
         TRIM(REGEXP_REPLACE(
           REGEXP_REPLACE(t.animal_nome, '^(Prenhez|Aspiração)\s+', '', 'i'),
           '\s*\([^)]*\)\s*$', '', 'g'
         )) AS nome_limpo
  FROM   transactions t
  WHERE  NOT EXISTS (SELECT 1 FROM transaction_animals ta WHERE ta.transaction_id = t.id)
)
SELECT o.id, o.tipo, o.animal_nome, o.contraparte, o.valor_total, o.data
FROM   orfas o
WHERE  NOT EXISTS (
         SELECT 1 FROM animals a
         WHERE  a.farm_id = o.farm_id
           AND ( LOWER(a.nome) = LOWER(o.nome_limpo)
              OR LOWER(a.nome) LIKE '%' || LOWER(o.nome_limpo) || '%'
              OR LOWER(o.nome_limpo) LIKE '%' || LOWER(a.nome) || '%' )
       )
ORDER  BY o.valor_total DESC;


-- ─── CONSULTA 3 — Transações sem data ────────────────────────────────────────
--   Sem data, o financeiro não consegue estimar parcelas pagas e mostra
--   saldo devedor integral. Preencher a data resolve a maioria dos casos;
--   alternativa é informar o nº de parcelas pagas na coluna Parcelas.

SELECT id,
       tipo,
       animal_nome,
       contraparte,
       valor_total,
       n_parcelas,
       parcelas_pagas_manual
FROM   transactions
WHERE  farm_id = (SELECT farm_id FROM transactions LIMIT 1)
  AND  data IS NULL
ORDER  BY valor_total DESC;

-- Total travado por falta de data:
SELECT COUNT(*)          AS lancamentos_sem_data,
       SUM(valor_total)  AS valor_total_afetado
FROM   transactions
WHERE  data IS NULL;


-- ─── APLICAR (opcional) — vincular só os EXATO e sem ambiguidade ─────────────
--   Descomente e rode DEPOIS de revisar a Consulta 1.
--   Vincula apenas onde o nome limpo bate exatamente com UM único animal.
--   Ignora nomes com "fêmeas"/"femeas" (compras de mais de uma cria) e
--   "oócito"/"oocito" (não é animal).

/*
BEGIN;

WITH orfas AS (
  SELECT t.id, t.farm_id, t.animal_nome,
         TRIM(REGEXP_REPLACE(
           REGEXP_REPLACE(t.animal_nome, '^(Prenhez|Aspiração)\s+', '', 'i'),
           '\s*\([^)]*\)\s*$', '', 'g'
         )) AS nome_limpo
  FROM   transactions t
  WHERE  NOT EXISTS (SELECT 1 FROM transaction_animals ta WHERE ta.transaction_id = t.id)
    AND  t.animal_nome IS NOT NULL
    AND  t.animal_nome !~* '(f[eê]meas|o[oó]cito)'
),
unicos AS (
  SELECT o.id AS transaction_id, MIN(a.id::TEXT)::UUID AS animal_id
  FROM   orfas o
  JOIN   animals a ON a.farm_id = o.farm_id
                  AND LOWER(TRIM(a.nome)) = LOWER(o.nome_limpo)
  GROUP  BY o.id
  HAVING COUNT(*) = 1
)
INSERT INTO transaction_animals (transaction_id, animal_id)
SELECT transaction_id, animal_id FROM unicos
ON CONFLICT DO NOTHING;

-- Sincroniza as colunas legadas
UPDATE transactions t
SET    doadora_id = ta.animal_id,
       animal_id  = ta.animal_id
FROM   transaction_animals ta
WHERE  ta.transaction_id = t.id
  AND  t.doadora_id IS NULL;

COMMIT;

-- Conferência
SELECT COUNT(*) AS ainda_sem_vinculo
FROM   transactions t
WHERE  NOT EXISTS (SELECT 1 FROM transaction_animals ta WHERE ta.transaction_id = t.id);
*/
