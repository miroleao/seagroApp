-- Vincula a cria parida diretamente ao animal receptora (para casos sem TE no sistema)
ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS cria_id uuid REFERENCES animals(id);
