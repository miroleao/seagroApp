-- =====================================================================
-- fix_all_reproducao.sql
-- SE Agropecuária Nelore de Elite — Correção Completa do Módulo de Reprodução
-- Execute UMA ÚNICA VEZ no Supabase SQL Editor
-- Seguro: todas as operações usam IF NOT EXISTS / IF EXISTS
-- =====================================================================

-- ── 1. custo_total: converter GENERATED ALWAYS para coluna editável ──
--    O schema original criou como coluna calculada, o que impede INSERT/UPDATE
--    direto. Este bloco converte para campo normal somente se ainda for gerada.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'aspirations'
      AND column_name  = 'custo_total'
      AND is_generated = 'ALWAYS'
  ) THEN
    DROP VIEW IF EXISTS v_donor_efficiency;

    ALTER TABLE aspirations DROP COLUMN custo_total;
    ALTER TABLE aspirations ADD COLUMN custo_total NUMERIC(12,2);

    UPDATE aspirations
       SET custo_total =
             COALESCE(custo_veterinario, 0)
           + COALESCE(custo_laboratorio, 0)
           + COALESCE(custo_receptoras, 0);

    CREATE OR REPLACE VIEW v_donor_efficiency AS
    SELECT
        asp.farm_id,
        COALESCE(d.nome, asp.doadora_nome)   AS doadora,
        COALESCE(d.rgn,  asp.doadora_rgn)    AS doadora_rgn,
        s.data                               AS data_sessao,
        asp.oocitos_viaveis,
        asp.embryos_congelados,
        COUNT(tr.id)                         AS total_te,
        COUNT(dg.id) FILTER (WHERE dg.resultado = 'POSITIVO') AS total_positivo,
        ROUND(
            COUNT(dg.id) FILTER (WHERE dg.resultado = 'POSITIVO') * 100.0
            / NULLIF(asp.embryos_congelados, 0), 1
        )                                    AS taxa_prenhez_pct,
        asp.custo_total,
        ROUND(
            asp.custo_total / NULLIF(
                COUNT(dg.id) FILTER (WHERE dg.resultado = 'POSITIVO'), 0
            ), 2
        )                                    AS custo_por_positivo
    FROM aspirations asp
    JOIN opu_sessions s    ON s.id  = asp.session_id
    LEFT JOIN animals d    ON d.id  = asp.doadora_id
    LEFT JOIN embryos e    ON e.aspiration_id = asp.id
    LEFT JOIN transfers tr ON tr.embryo_id = e.id
    LEFT JOIN pregnancy_diagnoses dg ON dg.transfer_id = tr.id
    GROUP BY asp.farm_id,
             COALESCE(d.nome, asp.doadora_nome),
             COALESCE(d.rgn,  asp.doadora_rgn),
             s.data,
             asp.oocitos_viaveis, asp.embryos_congelados, asp.custo_total
    ORDER BY COALESCE(d.nome, asp.doadora_nome), s.data;

    RAISE NOTICE '✅ custo_total convertido para coluna editável com sucesso.';
  ELSE
    RAISE NOTICE '✅ custo_total já é coluna normal — nenhuma ação necessária.';
  END IF;
END $$;


-- ── 2. Datas adicionais em opu_sessions ──────────────────────────────
ALTER TABLE opu_sessions
  ADD COLUMN IF NOT EXISTS data_fiv      DATE,
  ADD COLUMN IF NOT EXISTS data_dg       DATE,
  ADD COLUMN IF NOT EXISTS data_sexagem  DATE;


-- ── 3. Campos adicionais em aspirations ──────────────────────────────
ALTER TABLE aspirations
  ADD COLUMN IF NOT EXISTS doadora_rgn      TEXT,
  ADD COLUMN IF NOT EXISTS touro_rgn        TEXT,
  ADD COLUMN IF NOT EXISTS implantados      INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prenhezes_count  INTEGER DEFAULT 0;


-- ── 4. Campos de gestão em animals ───────────────────────────────────
ALTER TABLE animals ADD COLUMN IF NOT EXISTS classificacao   TEXT;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS data_entrada    DATE;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS forma_entrada   TEXT;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS status_rebanho  TEXT;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS peso_atual      NUMERIC(7,2);


-- ── 5. Corrigir constraint de status_rebanho para incluir 'ATIVA' ────
--    O código usa 'ATIVA' para receptoras sem DG positivo.
--    A constraint antiga não incluía esse valor, causando erro no INSERT.
ALTER TABLE animals DROP CONSTRAINT IF EXISTS animals_status_rebanho_check;
ALTER TABLE animals ADD CONSTRAINT animals_status_rebanho_check
  CHECK (status_rebanho IN (
    'ATIVA',
    'PROTOCOLADA', 'INSEMINADA', 'IMPLANTADA',
    'PRENHA', 'PRENHA_EMBRIAO', 'PRENHA_NATURAL',
    'FALHADA', 'VAZIA',
    'VENDIDA', 'MORTA', 'DESCARTE'
  ));


-- ── 6. Constraint de classificacao ───────────────────────────────────
ALTER TABLE animals DROP CONSTRAINT IF EXISTS animals_classificacao_check;
ALTER TABLE animals ADD CONSTRAINT animals_classificacao_check
  CHECK (classificacao IN ('RECEPTORA', 'RECRIA', 'DESCARTE', 'OUTRO'));


-- ── 7. Constraint de forma_entrada ───────────────────────────────────
ALTER TABLE animals DROP CONSTRAINT IF EXISTS animals_forma_entrada_check;
ALTER TABLE animals ADD CONSTRAINT animals_forma_entrada_check
  CHECK (forma_entrada IN ('COMPRA', 'EMPRESTIMO', 'PROPRIO', 'DOACAO', 'OUTRO'));


-- ── 8. Campos reprodutivos em animals (touros e histórico de parto) ──
ALTER TABLE animals ADD COLUMN IF NOT EXISTS rgd_touro_prenhez      TEXT;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS data_inseminacao        DATE;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS touro_ultimo_parto      TEXT;
ALTER TABLE animals ADD COLUMN IF NOT EXISTS rgd_touro_ultimo_parto  TEXT;


-- ── 9. Tabela de pesagens (se ainda não existir) ─────────────────────
CREATE TABLE IF NOT EXISTS pesagens (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  farm_id     UUID NOT NULL REFERENCES farms(id)   ON DELETE CASCADE,
  animal_id   UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
  data        DATE NOT NULL,
  peso_kg     NUMERIC(7,2) NOT NULL,
  observacoes TEXT,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pesagens_animal_idx ON pesagens(animal_id, data DESC);
CREATE INDEX IF NOT EXISTS pesagens_farm_idx   ON pesagens(farm_id);


-- ── 10. Verificação final ─────────────────────────────────────────────
SELECT
  table_name,
  column_name,
  data_type,
  is_generated,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('aspirations', 'opu_sessions', 'animals')
  AND column_name IN (
    'custo_total',
    'data_fiv', 'data_dg', 'data_sexagem',
    'doadora_rgn', 'touro_rgn', 'implantados', 'prenhezes_count',
    'status_rebanho', 'classificacao', 'data_entrada', 'forma_entrada'
  )
ORDER BY table_name, column_name;
