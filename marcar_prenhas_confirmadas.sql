-- ============================================================================
-- Marca receptoras como PRENHA_EMBRIAO (confirmadas) e atualiza seus DGs para POSITIVO.
-- Use depois de rodar fix_status_implantada.sql, quando você souber quais receptoras
-- realmente tinham prenhez confirmada.
--
-- COMO USAR:
--   1. Preencha a lista de brincos no array abaixo (ex: 'SE081', 'SE082', ...)
--   2. Rode no Supabase SQL Editor.
-- ============================================================================

WITH receptoras_confirmadas AS (
  SELECT id FROM animals
  WHERE tipo = 'RECEPTORA'
    AND brinco = ANY(ARRAY[
      -- ⬇️ COLE OS BRINCOS AQUI, UM POR LINHA, ENTRE ASPAS, SEPARADOS POR VÍRGULA ⬇️
      'SE081',
      'SE082',
      'SE084'
      -- adicione/remova brincos conforme necessário
    ])
)
-- 1. Atualiza o DG aberto (AGUARDANDO mais recente) para POSITIVO
UPDATE pregnancy_diagnoses pd
SET resultado = 'POSITIVO'
WHERE pd.id IN (
  SELECT DISTINCT ON (t.receptora_id) pd2.id
  FROM transfers t
  JOIN pregnancy_diagnoses pd2 ON pd2.transfer_id = t.id
  WHERE t.receptora_id IN (SELECT id FROM receptoras_confirmadas)
    AND pd2.resultado = 'AGUARDANDO'
    AND pd2.data_desfecho IS NULL
  ORDER BY t.receptora_id, pd2.data_dg DESC NULLS LAST
);

-- 2. Atualiza status_rebanho das receptoras → PRENHA_EMBRIAO
UPDATE animals
SET status_rebanho = 'PRENHA_EMBRIAO'
WHERE tipo = 'RECEPTORA'
  AND brinco = ANY(ARRAY[
    -- ⬇️ MESMA LISTA DE BRINCOS AQUI ⬇️
    'SE081',
    'SE082',
    'SE084'
  ]);
