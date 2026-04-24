-- ============================================================
-- Migração: campos reprodutivos detalhados
-- ============================================================

-- RGD e nome do touro da inseminação/cobertura atual
ALTER TABLE animals ADD COLUMN IF NOT EXISTS rgd_touro_prenhez   TEXT;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS data_inseminacao    DATE;

-- Dados do touro no momento do último parto (preservados ao registrar PARIDA)
ALTER TABLE animals ADD COLUMN IF NOT EXISTS touro_ultimo_parto      TEXT;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS rgd_touro_ultimo_parto  TEXT;

COMMENT ON COLUMN animals.rgd_touro_prenhez       IS 'RGD/RGN do touro utilizado na cobertura/inseminação atual.';
COMMENT ON COLUMN animals.data_inseminacao        IS 'Data da última inseminação ou TE.';
COMMENT ON COLUMN animals.touro_ultimo_parto      IS 'Nome do touro do último parto registrado.';
COMMENT ON COLUMN animals.rgd_touro_ultimo_parto  IS 'RGD do touro do último parto registrado.';
