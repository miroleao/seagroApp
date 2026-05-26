-- Receptoras Externas (em central ou outra fazenda)
-- Adiciona flag is_external e garante que localizacao já existe na tabela animals.
-- Receptoras com is_external = TRUE não aparecem no rebanho da fazenda,
-- mas continuam vinculadas às aspirações/transferências/prenhezes normalmente.

ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS is_external BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice para acelerar o filtro no rebanho
CREATE INDEX IF NOT EXISTS idx_animals_is_external
  ON animals (farm_id, is_external)
  WHERE is_external = TRUE;

-- localizacao já existe na tabela (era opcional para localização de pasto/lote).
-- Quando is_external = TRUE, localizacao passa a indicar a fazenda/central onde
-- o animal está alojado (ex: "Central Valença - MG").
