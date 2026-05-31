-- ══════════════════════════════════════════════════════════════════════════════
-- Tabela de log de movimentação reprodutiva das receptoras
-- Registra cada mudança de status_rebanho com data e observação opcional
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS animal_status_log (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  farm_id      UUID        NOT NULL REFERENCES animals(farm_id) ON DELETE CASCADE,
  animal_id    UUID        NOT NULL REFERENCES animals(id)      ON DELETE CASCADE,
  status       VARCHAR(40) NOT NULL,
  observacoes  TEXT,
  data_evento  DATE        NOT NULL DEFAULT CURRENT_DATE,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_status_log_animal ON animal_status_log (animal_id, data_evento DESC);
CREATE INDEX IF NOT EXISTS idx_status_log_farm   ON animal_status_log (farm_id);
