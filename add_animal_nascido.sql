-- Linka o animal nascido de volta à aspiração (prenhez comprada)
-- Permite: (1) mostrar "Ver ficha" na lista de prenhezes sem duplicar registro
--          (2) mostrar custo de aquisição na ficha financeira do animal nascido

ALTER TABLE aspirations
  ADD COLUMN IF NOT EXISTS animal_nascido_id   UUID REFERENCES animals(id),
  ADD COLUMN IF NOT EXISTS animal_nascido_tipo TEXT; -- "DOADORA" ou "TOURO"

-- Índice para lookup inverso (animal → prenhez de origem)
CREATE INDEX IF NOT EXISTS idx_aspirations_animal_nascido_id
  ON aspirations (animal_nascido_id)
  WHERE animal_nascido_id IS NOT NULL;
