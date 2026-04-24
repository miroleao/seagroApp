-- =====================================================================
-- fix_reproducao.sql
-- SE Agropecuária Nelore de Elite — Correções do Módulo de Reprodução
-- Execute no Supabase SQL Editor (uma única vez)
-- =====================================================================

-- ── 1. custo_total: trocar GENERATED ALWAYS por coluna editável ───────
-- O schema original criou custo_total como GENERATED ALWAYS
-- (soma automática dos sub-custos), o que impede qualquer INSERT/UPDATE
-- direto. A solução é remover a coluna gerada e recriar como campo normal.
--
-- A view v_donor_efficiency depende de custo_total, por isso é preciso
-- derrubá-la e recriá-la dentro do mesmo bloco transacional.

DO $$
BEGIN
  -- Só age se a coluna ainda for gerada
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'aspirations'
      AND column_name  = 'custo_total'
      AND is_generated = 'ALWAYS'
  ) THEN
    -- 1a. Remover a view dependente antes de dropar a coluna
    DROP VIEW IF EXISTS v_donor_efficiency;

    -- 1b. Trocar coluna gerada por coluna editável
    ALTER TABLE aspirations DROP COLUMN custo_total;
    ALTER TABLE aspirations ADD COLUMN custo_total NUMERIC(12,2);

    -- 1c. Restaurar os valores calculados para linhas existentes
    UPDATE aspirations
       SET custo_total =
             COALESCE(custo_veterinario, 0)
           + COALESCE(custo_laboratorio, 0)
           + COALESCE(custo_receptoras, 0);

    -- 1d. Recriar a view v_donor_efficiency (idêntica ao schema original)
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
            / NULLIF(asp.embryos_congelados, 0),
        1)                                   AS taxa_prenhez_pct,
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

    COMMENT ON VIEW v_donor_efficiency IS
        'Eficiência reprodutiva por doadora: oócitos, embriões, TEs, P+, taxa de prenhez e custo por P+.';

    RAISE NOTICE 'custo_total convertido para coluna editável; v_donor_efficiency recriada com sucesso.';
  ELSE
    RAISE NOTICE 'custo_total já é uma coluna normal — nenhuma ação necessária.';
  END IF;
END $$;


-- ── 2. Datas adicionais na sessão OPU ────────────────────────────────
ALTER TABLE opu_sessions
  ADD COLUMN IF NOT EXISTS data_fiv      date,
  ADD COLUMN IF NOT EXISTS data_dg       date,
  ADD COLUMN IF NOT EXISTS data_sexagem  date;


-- ── 3. Campos de rastreamento nas aspirações ─────────────────────────
ALTER TABLE aspirations
  ADD COLUMN IF NOT EXISTS touro_rgn       text,
  ADD COLUMN IF NOT EXISTS implantados     integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prenhezes_count integer DEFAULT 0;


-- ── 4. Verificação final ──────────────────────────────────────────────
SELECT
  column_name,
  data_type,
  is_generated,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name   IN ('aspirations', 'opu_sessions')
  AND column_name  IN (
    'custo_total',
    'data_fiv', 'data_dg', 'data_sexagem',
    'touro_rgn', 'implantados', 'prenhezes_count'
  )
ORDER BY table_name, column_name;
