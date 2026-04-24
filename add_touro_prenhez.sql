-- Adiciona coluna touro_prenhez na tabela animals
-- Representa o touro (Pai da Prenhez) usado na inseminação/transferência atual da doadora

ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS touro_prenhez TEXT;

COMMENT ON COLUMN animals.touro_prenhez IS
  'Touro utilizado na cobertura/inseminação atual da doadora (Pai da Prenhez).';
