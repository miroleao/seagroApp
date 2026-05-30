-- ============================================================================
-- Tabela: semen_uses
-- Registra cada saída/uso de doses de sêmen do estoque (FIV ou IATF).
-- O `doses` da semen_stock deve ser atualizado em paralelo via aplicação.
-- ============================================================================

CREATE TABLE IF NOT EXISTS semen_uses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  farm_id         UUID NOT NULL,
  semen_stock_id  UUID NOT NULL REFERENCES semen_stock(id) ON DELETE CASCADE,
  data_saida      DATE NOT NULL,
  doses_usadas    INTEGER NOT NULL CHECK (doses_usadas > 0),
  tipo_uso        TEXT NOT NULL CHECK (tipo_uso IN ('FIV', 'IATF')),
  doadora_id      UUID REFERENCES animals(id) ON DELETE SET NULL,
  doadora_nome    TEXT,
  veterinario     TEXT,
  usuario_nome    TEXT,
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_semen_uses_farm_id   ON semen_uses(farm_id);
CREATE INDEX IF NOT EXISTS idx_semen_uses_stock_id  ON semen_uses(semen_stock_id);
CREATE INDEX IF NOT EXISTS idx_semen_uses_doadora   ON semen_uses(doadora_id);
CREATE INDEX IF NOT EXISTS idx_semen_uses_data      ON semen_uses(data_saida DESC);
