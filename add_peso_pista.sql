-- Peso oficial aferido na pesagem de exposição / pista
-- Rodar no Supabase SQL Editor

ALTER TABLE animals ADD COLUMN IF NOT EXISTS peso_pista numeric(6,2);

COMMENT ON COLUMN animals.peso_pista IS 'Peso aferido na pesagem oficial de exposição (separado do peso_atual)';
