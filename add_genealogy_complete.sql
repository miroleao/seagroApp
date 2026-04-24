-- ============================================================
-- Migração: Genealogia completa (3 gerações)
-- SE Agropecuária Nelore de Elite
-- Execute no SQL Editor do Supabase
-- ============================================================
-- Estrutura:
--   Geração 1: pai_nome, mae_nome              (já existem)
--   Geração 2: avô/avó paternos e maternos
--   Geração 3: bisavô/bisavó de cada avô/avó
-- ============================================================

-- ── Avós Paternos (pais do Pai) ──────────────────────────────
ALTER TABLE animals ADD COLUMN IF NOT EXISTS avo_paterno   TEXT;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS avo_paterna   TEXT;

-- ── Bisavós do Avô Paterno ───────────────────────────────────
ALTER TABLE animals ADD COLUMN IF NOT EXISTS bisavo_pat_pat   TEXT;  -- pai do avô paterno
ALTER TABLE animals ADD COLUMN IF NOT EXISTS bisava_pat_pat   TEXT;  -- mãe do avô paterno

-- ── Bisavós da Avó Paterna ───────────────────────────────────
ALTER TABLE animals ADD COLUMN IF NOT EXISTS bisavo_pat_mat   TEXT;  -- pai da avó paterna
ALTER TABLE animals ADD COLUMN IF NOT EXISTS bisava_pat_mat   TEXT;  -- mãe da avó paterna

-- ── Bisavó do Avô Materno (novo — o bisavô já existe) ────────
ALTER TABLE animals ADD COLUMN IF NOT EXISTS bisava_mat_pat   TEXT;  -- mãe do avô materno

-- ── Campos já existentes — apenas comentários ────────────────
-- avo_materno    = pai da mãe                       (já existe)
-- avo_materna    = mãe da mãe                       (já existe)
-- bisavo_materno = pai do avô materno               (já existe)
-- bisavo_materna = pai da avó materna               (já existe)
-- bisavo         = mãe da avó materna (bisavó mat.) (já existe)

COMMENT ON COLUMN animals.avo_paterno   IS 'Avô Paterno — pai do pai';
COMMENT ON COLUMN animals.avo_paterna   IS 'Avó Paterna — mãe do pai';
COMMENT ON COLUMN animals.bisavo_pat_pat IS 'Bisavô Avô Paterno — pai do avô paterno';
COMMENT ON COLUMN animals.bisava_pat_pat IS 'Bisavó Avô Paterno — mãe do avô paterno';
COMMENT ON COLUMN animals.bisavo_pat_mat IS 'Bisavô Avó Paterna — pai da avó paterna';
COMMENT ON COLUMN animals.bisava_pat_mat IS 'Bisavó Avó Paterna — mãe da avó paterna';
COMMENT ON COLUMN animals.bisava_mat_pat IS 'Bisavó Avô Materno — mãe do avô materno';
