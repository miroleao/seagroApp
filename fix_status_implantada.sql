-- Corrige receptoras marcadas como PRENHA_EMBRIAO que ainda não têm DG positivo.
-- Regra: se status_rebanho = PRENHA_EMBRIAO mas o DG mais recente é AGUARDANDO
-- (ou não há DG positivo), volta para IMPLANTADA.

UPDATE animals a
SET status_rebanho = 'IMPLANTADA'
WHERE a.tipo = 'RECEPTORA'
  AND a.status_rebanho = 'PRENHA_EMBRIAO'
  AND NOT EXISTS (
    -- existe ao menos um DG POSITIVO ligado a esta receptora?
    SELECT 1
    FROM transfers t
    JOIN pregnancy_diagnoses pd ON pd.transfer_id = t.id
    WHERE t.receptora_id = a.id
      AND pd.resultado = 'POSITIVO'
  )
  AND EXISTS (
    -- mas tem ao menos um transfer com DG AGUARDANDO (foi implantada)
    SELECT 1
    FROM transfers t
    JOIN pregnancy_diagnoses pd ON pd.transfer_id = t.id
    WHERE t.receptora_id = a.id
      AND pd.resultado = 'AGUARDANDO'
  );
