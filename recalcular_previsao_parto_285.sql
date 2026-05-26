-- Recalcula data_previsao_parto para T.E. + 285 dias em todos os registros ativos.
-- Afeta apenas prenhezes com resultado POSITIVO ou AGUARDANDO e sem desfecho encerrado
-- (tipo_desfecho IS NULL), pois as já encerradas não têm mais relevância prática.

UPDATE pregnancy_diagnoses pd
SET    data_previsao_parto = (
         SELECT (t.data_te::date + INTERVAL '285 days')::date
         FROM   transfers t
         WHERE  t.id = pd.transfer_id
           AND  t.data_te IS NOT NULL
       )
WHERE  pd.resultado      IN ('POSITIVO', 'AGUARDANDO')
  AND  pd.tipo_desfecho  IS NULL
  AND  EXISTS (
         SELECT 1
         FROM   transfers t
         WHERE  t.id = pd.transfer_id
           AND  t.data_te IS NOT NULL
       );

-- Quantas linhas foram atualizadas (rode após o UPDATE para conferir):
-- SELECT COUNT(*) FROM pregnancy_diagnoses
-- WHERE resultado IN ('POSITIVO','AGUARDANDO') AND tipo_desfecho IS NULL;
