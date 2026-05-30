-- ============================================================================
-- Tabela: semen_stock
-- Estoque de doses de sêmen por touro (convencional ou sexado fêmea).
-- ============================================================================

CREATE TABLE IF NOT EXISTS semen_stock (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id             UUID NOT NULL,
  touro_id            UUID REFERENCES animals(id) ON DELETE SET NULL,
  touro_nome          TEXT NOT NULL,
  touro_rgn           TEXT,
  doses               INTEGER NOT NULL DEFAULT 0 CHECK (doses >= 0),
  tipo                TEXT NOT NULL CHECK (tipo IN ('CONVENCIONAL', 'SEXADO_FEMEA')),
  local_armazenamento TEXT,
  valor_por_dose      NUMERIC(10, 2),
  observacoes         TEXT,
  criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_semen_stock_farm_id  ON semen_stock(farm_id);
CREATE INDEX IF NOT EXISTS idx_semen_stock_touro_id ON semen_stock(touro_id);
CREATE INDEX IF NOT EXISTS idx_semen_stock_tipo     ON semen_stock(tipo);
