-- Adiciona FK para o animal nascido no diagnóstico de prenhez
-- Permite linkar o bezerro diretamente ao parto da receptora

ALTER TABLE pregnancy_diagnoses
  ADD COLUMN IF NOT EXISTS animal_nascido_id uuid REFERENCES animals(id);
