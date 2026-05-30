-- ============================================================================
-- Corrige dados criados pelo fluxo antigo (OPU/nova marcava DG POSITIVO automaticamente).
-- Regra de negócio: após T.E. status = IMPLANTADA; só vira PRENHA_EMBRIAO após DG real.
-- ============================================================================

-- 0. Garante que a check constraint de pregnancy_diagnoses.resultado aceita AGUARDANDO.
ALTER TABLE pregnancy_diagnoses
  DROP CONSTRAINT IF EXISTS pregnancy_diagnoses_resultado_check;

ALTER TABLE pregnancy_diagnoses
  ADD CONSTRAINT pregnancy_diagnoses_resultado_check
  CHECK (resultado IN ('AGUARDANDO', 'POSITIVO', 'NEGATIVO', 'VAZIO', 'ABSORVEU', 'ABORTOU'));

-- 1. DGs auto-criados (POSITIVO sem desfecho) viram AGUARDANDO.
--    Mantém intactos os DGs que já têm desfecho (data_desfecho ou tipo_desfecho preenchidos).
UPDATE pregnancy_diagnoses pd
SET resultado = 'AGUARDANDO'
WHERE pd.resultado = 'POSITIVO'
  AND pd.data_desfecho IS NULL
  AND pd.tipo_desfecho IS NULL;

-- 2. Receptoras marcadas como PRENHA_EMBRIAO que não têm mais DG POSITIVO
--    (após o passo 1) viram IMPLANTADA.
UPDATE animals a
SET status_rebanho = 'IMPLANTADA'
WHERE a.tipo = 'RECEPTORA'
  AND a.status_rebanho = 'PRENHA_EMBRIAO'
  AND NOT EXISTS (
    SELECT 1
    FROM transfers t
    JOIN pregnancy_diagnoses pd ON pd.transfer_id = t.id
    WHERE t.receptora_id = a.id
      AND pd.resultado = 'POSITIVO'
  )
  AND EXISTS (
    SELECT 1 FROM transfers t WHERE t.receptora_id = a.id
  );
