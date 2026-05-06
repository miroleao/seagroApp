-- Migration: prevenir duplicidade de animais por brinco e RGN
-- Rodar no Supabase SQL Editor

-- Índice único parcial para brinco (ignora NULLs e strings vazias)
CREATE UNIQUE INDEX IF NOT EXISTS animals_farm_brinco_unique
  ON animals (farm_id, brinco)
  WHERE brinco IS NOT NULL AND brinco <> '';

-- Índice único parcial para RGN (ignora NULLs e strings vazias)
CREATE UNIQUE INDEX IF NOT EXISTS animals_farm_rgn_unique
  ON animals (farm_id, rgn)
  WHERE rgn IS NOT NULL AND rgn <> '';

-- Após criar os índices, se houver duplicatas existentes o CREATE falhará.
-- Nesse caso, identifique os duplicados com:
--
-- SELECT farm_id, brinco, COUNT(*), array_agg(id) as ids
-- FROM animals
-- WHERE brinco IS NOT NULL AND brinco <> ''
-- GROUP BY farm_id, brinco HAVING COUNT(*) > 1;
--
-- SELECT farm_id, rgn, COUNT(*), array_agg(id) as ids
-- FROM animals
-- WHERE rgn IS NOT NULL AND rgn <> ''
-- GROUP BY farm_id, rgn HAVING COUNT(*) > 1;
