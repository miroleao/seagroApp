-- ============================================================
-- Migração: bisavós maternos no heredograma
-- SE Agropecuária Nelore de Elite
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Bisavô Materno (pai do avô materno)
ALTER TABLE animals ADD COLUMN IF NOT EXISTS bisavo_materno  TEXT;

-- Bisavô da Avó Materna (pai da avó materna)
ALTER TABLE animals ADD COLUMN IF NOT EXISTS bisavo_materna  TEXT;

COMMENT ON COLUMN animals.bisavo_materno IS 'Bisavô materno — pai do avô materno';
COMMENT ON COLUMN animals.bisavo_materna IS 'Bisavô da avó materna — pai da avó materna';
-- Nota: o campo existente `bisavo` continua sendo a Bisavó da Avó Materna (mãe da avó materna)
