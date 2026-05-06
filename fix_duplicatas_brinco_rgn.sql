-- ══════════════════════════════════════════════════════════════════
-- PASSO 1: Ver todos os brincos duplicados com os dados dos animais
-- ══════════════════════════════════════════════════════════════════
SELECT
  a.brinco,
  a.id,
  a.nome,
  a.tipo,
  a.classificacao,
  a.status_rebanho,
  a.data_entrada,
  a.nascimento,
  a.created_at
FROM animals a
WHERE a.farm_id = (SELECT farm_id FROM animals WHERE brinco IS NOT NULL LIMIT 1)
  AND a.brinco IN (
    SELECT brinco
    FROM animals
    WHERE brinco IS NOT NULL AND brinco <> '' AND farm_id IS NOT NULL
    GROUP BY farm_id, brinco
    HAVING COUNT(*) > 1
  )
ORDER BY a.brinco, a.created_at;


-- ══════════════════════════════════════════════════════════════════
-- PASSO 2: Ver todos os RGNs duplicados
-- ══════════════════════════════════════════════════════════════════
SELECT
  a.rgn,
  a.id,
  a.nome,
  a.tipo,
  a.status_rebanho,
  a.nascimento,
  a.created_at
FROM animals a
WHERE a.farm_id = (SELECT farm_id FROM animals WHERE rgn IS NOT NULL LIMIT 1)
  AND a.rgn IN (
    SELECT rgn
    FROM animals
    WHERE rgn IS NOT NULL AND rgn <> '' AND farm_id IS NOT NULL
    GROUP BY farm_id, rgn
    HAVING COUNT(*) > 1
  )
ORDER BY a.rgn, a.created_at;


-- ══════════════════════════════════════════════════════════════════
-- PASSO 3 (após decidir qual manter): Deletar o registro duplicado
-- Substitua o UUID pelo id do animal que você quer REMOVER
-- ══════════════════════════════════════════════════════════════════
-- DELETE FROM animals WHERE id = 'UUID-DO-ANIMAL-DUPLICADO-A-REMOVER';


-- ══════════════════════════════════════════════════════════════════
-- PASSO 4: Após limpar todos os duplicados, rodar os índices únicos
-- ══════════════════════════════════════════════════════════════════
-- CREATE UNIQUE INDEX IF NOT EXISTS animals_farm_brinco_unique
--   ON animals (farm_id, brinco)
--   WHERE brinco IS NOT NULL AND brinco <> '';
--
-- CREATE UNIQUE INDEX IF NOT EXISTS animals_farm_rgn_unique
--   ON animals (farm_id, rgn)
--   WHERE rgn IS NOT NULL AND rgn <> '';
