-- ============================================================
-- Migração: campos reprodutivos para touros (machos)
-- SE Agropecuária Nelore de Elite
-- Execute no SQL Editor do Supabase
-- ============================================================

-- Exame Andrológico
ALTER TABLE animals ADD COLUMN IF NOT EXISTS exame_andrologico        TEXT CHECK (exame_andrologico IN ('APTO', 'INAPTO'));
ALTER TABLE animals ADD COLUMN IF NOT EXISTS data_exame_andrologico   DATE;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS veterinario_andrologico  TEXT;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS laudo_andrologico        TEXT;   -- Número/código do laudo

-- Circunferência Escrotal (CE) — em centímetros
ALTER TABLE animals ADD COLUMN IF NOT EXISTS circunferencia_escrotal  NUMERIC(5,1);
ALTER TABLE animals ADD COLUMN IF NOT EXISTS data_ce                  DATE;

-- RGD (Registro Genealógico Definitivo) — obtido quando o touro é APTO
ALTER TABLE animals ADD COLUMN IF NOT EXISTS rgd                      TEXT;   -- Número do RGD (substitui RGN para reprodutores aptos)

COMMENT ON COLUMN animals.exame_andrologico       IS 'Resultado do exame andrológico: APTO ou INAPTO';
COMMENT ON COLUMN animals.data_exame_andrologico  IS 'Data da realização do exame andrológico';
COMMENT ON COLUMN animals.veterinario_andrologico IS 'Médico veterinário responsável pelo laudo';
COMMENT ON COLUMN animals.laudo_andrologico       IS 'Número ou código de referência do laudo';
COMMENT ON COLUMN animals.circunferencia_escrotal IS 'Circunferência escrotal em cm na última medição';
COMMENT ON COLUMN animals.data_ce                 IS 'Data da medição de circunferência escrotal';
COMMENT ON COLUMN animals.rgd                     IS 'Registro Genealógico Definitivo (ABCZ) — emitido após aprovação andrológica';
