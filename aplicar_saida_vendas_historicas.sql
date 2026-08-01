-- ============================================================
-- Saída retroativa de animais vendidos
-- ============================================================
-- CONTEXTO
--   Até agora uma venda era gravada em três lugares independentes:
--     · animal_leilao_info.venda_*   — card Leilão da ficha
--     · transactions (tipo VENDA)    — financeiro
--     · animals.status_rebanho       — desfecho (só no rebanho)
--   Nada sincronizava os três. Existem animais com venda lançada no
--   financeiro que continuam ativos, sem status e sem data de saída.
--
-- REGRA (definida com o Chefe)
--   Venda parcial NÃO dá saída — só reduz `percentual_proprio`.
--   A saída (status VENDIDA + data_saida) acontece quando a
--   participação da fazenda chega a zero.
--
--   Como o histórico não registrou o % de cada venda de forma confiável,
--   este script só aplica saída onde a venda é claramente de 100%:
--   `percentual_vendido` = 100 ou nulo (o padrão antigo era venda integral).
--
--   Passos 1 e 2 são só leitura. O 3 altera dados, com backup.
-- ============================================================


-- ─── PASSO 1 — Diagnóstico: onde os três registros divergem ──────────────────

SELECT
  a.id,
  a.nome,
  a.rgn,
  a.tipo,
  a.status_rebanho                                   AS status_atual,
  a.data_saida,
  ROUND(COALESCE(a.percentual_proprio, 1) * 100)     AS proprio_pct,
  COUNT(t.id)                                        AS vendas_no_financeiro,
  MAX(t.data)                                        AS ultima_venda,
  SUM(t.valor_total)                                 AS total_vendido,
  MIN(COALESCE(t.percentual_vendido, 100))           AS menor_pct_vendido,
  li.venda_comprador                                 AS comprador_no_card
FROM   animals a
JOIN   transactions t
  ON   t.farm_id = a.farm_id
 AND   t.tipo    = 'VENDA'
 AND   (t.doadora_id = a.id OR t.animal_id = a.id
        OR EXISTS (SELECT 1 FROM transaction_animals ta
                   WHERE ta.transaction_id = t.id AND ta.animal_id = a.id))
LEFT   JOIN animal_leilao_info li ON li.animal_id = a.id
WHERE  a.status_rebanho IS DISTINCT FROM 'VENDIDA'
GROUP  BY a.id, a.nome, a.rgn, a.tipo, a.status_rebanho, a.data_saida,
          a.percentual_proprio, li.venda_comprador
ORDER  BY MAX(t.data) DESC NULLS LAST;


-- ─── PASSO 2 — Quem receberia saída no Passo 3 ───────────────────────────────
--   Apenas vendas integrais (100% ou sem percentual registrado).

SELECT
  a.id, a.nome, a.rgn, a.status_rebanho,
  MAX(t.data)        AS data_saida_proposta,
  SUM(t.valor_total) AS total_vendido
FROM   animals a
JOIN   transactions t
  ON   t.farm_id = a.farm_id
 AND   t.tipo    = 'VENDA'
 AND   COALESCE(t.percentual_vendido, 100) >= 100
 AND   (t.doadora_id = a.id OR t.animal_id = a.id
        OR EXISTS (SELECT 1 FROM transaction_animals ta
                   WHERE ta.transaction_id = t.id AND ta.animal_id = a.id))
WHERE  a.status_rebanho IS DISTINCT FROM 'VENDIDA'
GROUP  BY a.id, a.nome, a.rgn, a.status_rebanho
ORDER  BY a.nome;


-- ─── PASSO 3 — Aplicar (APAGA/ALTERA DADOS) ──────────────────────────────────
--   Confira o Passo 2 antes. Descomente para rodar.

/*
CREATE TABLE IF NOT EXISTS animals_backup_saida AS
SELECT id, status_rebanho, data_saida, percentual_proprio FROM animals;

BEGIN;

WITH vendas_integrais AS (
  SELECT a.id                AS animal_id,
         MAX(t.data)         AS data_venda
  FROM   animals a
  JOIN   transactions t
    ON   t.farm_id = a.farm_id
   AND   t.tipo    = 'VENDA'
   AND   COALESCE(t.percentual_vendido, 100) >= 100
   AND   (t.doadora_id = a.id OR t.animal_id = a.id
          OR EXISTS (SELECT 1 FROM transaction_animals ta
                     WHERE ta.transaction_id = t.id AND ta.animal_id = a.id))
  WHERE  a.status_rebanho IS DISTINCT FROM 'VENDIDA'
  GROUP  BY a.id
)
UPDATE animals a
SET    status_rebanho     = 'VENDIDA',
       data_saida         = COALESCE(a.data_saida, v.data_venda),
       percentual_proprio = 0
FROM   vendas_integrais v
WHERE  a.id = v.animal_id;

COMMIT;
*/


-- ─── PASSO 4 — Vendas parciais: só ajusta a participação ─────────────────────
--   Sem status, sem data de saída. Descomente para rodar.

/*
BEGIN;

WITH parciais AS (
  SELECT a.id AS animal_id,
         SUM(COALESCE(t.percentual_vendido, 0)) / 100.0 AS fracao_vendida
  FROM   animals a
  JOIN   transactions t
    ON   t.farm_id = a.farm_id
   AND   t.tipo    = 'VENDA'
   AND   t.percentual_vendido IS NOT NULL
   AND   t.percentual_vendido < 100
   AND   (t.doadora_id = a.id OR t.animal_id = a.id
          OR EXISTS (SELECT 1 FROM transaction_animals ta
                     WHERE ta.transaction_id = t.id AND ta.animal_id = a.id))
  GROUP  BY a.id
)
UPDATE animals a
SET    percentual_proprio = GREATEST(0, 1 - p.fracao_vendida)
FROM   parciais p
WHERE  a.id = p.animal_id;

COMMIT;
*/


-- ─── PASSO 5 — Conferência ───────────────────────────────────────────────────
SELECT status_rebanho, COUNT(*) AS animais
FROM   animals
GROUP  BY status_rebanho
ORDER  BY animais DESC;

-- ─── Restaurar, se precisar ──────────────────────────────────────────────────
-- UPDATE animals a
-- SET status_rebanho = b.status_rebanho,
--     data_saida = b.data_saida,
--     percentual_proprio = b.percentual_proprio
-- FROM animals_backup_saida b WHERE b.id = a.id;
