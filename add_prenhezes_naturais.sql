-- Histórico de prenhezes naturais da doadora
-- Cada registro = uma prenhez (inseminação → resultado + nascimento opcional)
-- Roda no Supabase SQL Editor

CREATE TABLE IF NOT EXISTS prenhezes_naturais (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id           UUID NOT NULL,
  doadora_id        UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  data_inseminacao  DATE,
  touro_nome        TEXT,
  touro_rgd         TEXT,
  data_parto        DATE,
  resultado         TEXT NOT NULL DEFAULT 'ATIVA',
    -- ATIVA  = prenhez em curso
    -- PARIDA = nascimento ocorreu
    -- ABORTOU = aborto registrado
  animal_nascido_id UUID REFERENCES animals(id) ON DELETE SET NULL,
  observacoes       TEXT,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prenhezes_naturais_doadora
  ON prenhezes_naturais (doadora_id, criado_em DESC);

-- RLS (se usar Row Level Security no projeto)
-- ALTER TABLE prenhezes_naturais ENABLE ROW LEVEL SECURITY;
