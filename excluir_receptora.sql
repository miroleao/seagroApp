-- ============================================================================
-- excluir_receptora.sql
--
-- Exclui uma receptora cadastrada errada (brinco digitado errado, duplicata).
-- NÃO use para animal que saiu do rebanho — nesse caso registre o desfecho,
-- que preserva o histórico. Exclusão apaga o registro.
--
-- Alvo: receptora de brinco "RECP 2".
--
-- Rode no Supabase SQL Editor, um passo de cada vez.
-- ============================================================================


-- ── Passo 1: identificar o animal ───────────────────────────────────────────
-- Busca por aproximação, porque o cadastro errado pode ter espaço a mais ou
-- grafia diferente. A coluna brinco_exato mostra a string real entre colchetes
-- e tam_brinco o número de caracteres — se der 7 em vez de 6, tem espaço sobrando.
--
-- Confirme qual linha é a receptora a excluir. Se o brinco real for diferente
-- de 'RECP 2', troque nos Passos 2 e 3.

SELECT id,
       '[' || brinco || ']'  AS brinco_exato,
       LENGTH(brinco)        AS tam_brinco,
       nome, rgn, tipo, classificacao, status_rebanho,
       localizacao, data_entrada, observacoes
FROM animals
WHERE brinco ILIKE '%RECP%2%'
ORDER BY brinco;


-- ── Passo 2: conferir os vínculos ───────────────────────────────────────────
-- BLOQUEIA  → o Postgres recusa o delete. Registre desfecho em vez de excluir.
-- CASCATA   → some junto com o animal, sem aviso.
-- Só siga para o Passo 3 se todo BLOQUEIA estiver com total = 0.

WITH alvo AS (
  SELECT id FROM animals
  WHERE brinco = 'RECP 2' AND tipo IN ('RECEPTORA', 'DESCARTE')
)
SELECT 'BLOQUEIA' AS efeito, 'T.E. (transfers)'      AS vinculo, COUNT(*) AS total
  FROM transfers    WHERE receptora_id IN (SELECT id FROM alvo)
UNION ALL
SELECT 'BLOQUEIA', 'nascimentos (births)',            COUNT(*)
  FROM births       WHERE animal_id    IN (SELECT id FROM alvo)
UNION ALL
SELECT 'BLOQUEIA', 'premiações (awards)',             COUNT(*)
  FROM awards       WHERE animal_id    IN (SELECT id FROM alvo)
UNION ALL
SELECT 'BLOQUEIA', 'transações financeiras',          COUNT(*)
  FROM transactions WHERE animal_id    IN (SELECT id FROM alvo)
UNION ALL
SELECT 'BLOQUEIA', 'genealogia (mãe/pai/cria)',       COUNT(*)
  FROM animals      WHERE mae_id IN (SELECT id FROM alvo)
                       OR pai_id IN (SELECT id FROM alvo)
                       OR cria_id IN (SELECT id FROM alvo)
UNION ALL
SELECT 'CASCATA',  'pesagens (weight_records)',       COUNT(*)
  FROM weight_records  WHERE animal_id IN (SELECT id FROM alvo)
UNION ALL
SELECT 'CASCATA',  'sócios (animal_partners)',        COUNT(*)
  FROM animal_partners WHERE animal_id IN (SELECT id FROM alvo)
ORDER BY efeito, total DESC;


-- ── Passo 2b: o que está pendurado na T.E. ──────────────────────────────────
-- Rode quando o Passo 3 falhar com "violates foreign key constraint
-- transfers_receptora_id_fkey". Mostra a cadeia completa da transferência
-- para você decidir entre corrigir, repontar ou apagar.

SELECT
  t.id            AS transfer_id,
  t.data_te,
  t.receptora_brinco,
  e.id            AS embryo_id,
  e.numero_cdc_fiv,
  e.status        AS status_embriao,
  e.sexagem,
  d.nome          AS doadora,
  asp.touro_nome  AS touro,
  s.data          AS data_opu,
  pd.id           AS dg_id,
  pd.resultado    AS dg,
  pd.data_dg,
  pd.data_previsao_parto,
  pd.tipo_desfecho
FROM transfers t
LEFT JOIN embryos e            ON e.id  = t.embryo_id
LEFT JOIN aspirations asp      ON asp.id = e.aspiration_id
LEFT JOIN animals d            ON d.id  = asp.doadora_id
LEFT JOIN opu_sessions s       ON s.id  = asp.session_id
LEFT JOIN pregnancy_diagnoses pd ON pd.transfer_id = t.id
WHERE t.receptora_id = '2d98cd45-7e87-49ba-8de1-1400ce496838'
ORDER BY t.data_te DESC NULLS LAST;


-- ── Passo 3: excluir ────────────────────────────────────────────────────────
-- Rode só depois de confirmar que os BLOQUEIA estão zerados.
-- O RETURNING mostra o que foi apagado — se vier vazio, nada foi excluído.

DELETE FROM animals
WHERE brinco = 'RECP 2'
  AND tipo IN ('RECEPTORA', 'DESCARTE')
RETURNING id, brinco, nome, status_rebanho;


-- ============================================================================
-- Passo 4: EXCLUSÃO FORÇADA — apaga a cadeia inteira da RECP 2
--
-- Use quando o Passo 3 falhar por FK e você quiser remover tudo mesmo assim.
-- Roda em transação: se qualquer statement falhar, nada é aplicado.
--
-- Ordem obrigatória (filho antes do pai):
--   births → pregnancy_diagnoses → transfers → animals
--   (births cai por CASCADE ao apagar o DG; weight_records, animal_partners
--    e animal_status_log caem por CASCADE ao apagar o animal)
--
-- Os embriões que estavam nessas T.E. voltam para o estoque como DISPONIVEL,
-- senão ficariam marcados como IMPLANTADO apontando para uma receptora
-- que não existe mais.
-- ============================================================================

BEGIN;

-- 1. DGs das transferências dela (leva births junto por CASCADE)
DELETE FROM pregnancy_diagnoses
WHERE transfer_id IN (
  SELECT id FROM transfers
  WHERE receptora_id = '2d98cd45-7e87-49ba-8de1-1400ce496838'
);

-- 2. Devolve os embriões ao estoque
UPDATE embryos
SET status = 'DISPONIVEL'
WHERE id IN (
  SELECT embryo_id FROM transfers
  WHERE receptora_id = '2d98cd45-7e87-49ba-8de1-1400ce496838'
    AND embryo_id IS NOT NULL
);

-- 2-alt. Se os embriões forem fantasmas (criados só para registrar a T.E.,
--        sem doadora/CDC-FIV reais), troque o UPDATE acima por este DELETE
--        e rode-o DEPOIS do passo 3:
-- DELETE FROM embryos WHERE id IN (...);

-- 3. Transferências
DELETE FROM transfers
WHERE receptora_id = '2d98cd45-7e87-49ba-8de1-1400ce496838';

-- 4. O animal (pesagens, sócios e log de status caem por CASCADE)
DELETE FROM animals
WHERE id = '2d98cd45-7e87-49ba-8de1-1400ce496838'
RETURNING id, brinco, nome, status_rebanho;

COMMIT;


-- ── Passo 5: conferência ────────────────────────────────────────────────────
-- Ambas as contagens têm que voltar 0.

SELECT
  (SELECT COUNT(*) FROM animals
     WHERE id = '2d98cd45-7e87-49ba-8de1-1400ce496838')          AS animal_restante,
  (SELECT COUNT(*) FROM transfers
     WHERE receptora_id = '2d98cd45-7e87-49ba-8de1-1400ce496838') AS tes_restantes;
