-- ══════════════════════════════════════════════════════════════════════════════
-- Adiciona coluna data_saida em animals
-- Armazena a data de venda ou óbito do animal
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE animals ADD COLUMN IF NOT EXISTS data_saida DATE;

-- Índice para facilitar consultas de animais vendidos/mortos por data
CREATE INDEX IF NOT EXISTS idx_animals_data_saida ON animals (data_saida)
  WHERE data_saida IS NOT NULL;
