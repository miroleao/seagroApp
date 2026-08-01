-- ============================================================================
-- fix_dg_status_rebanho.sql
--
-- Corrige retroativamente as receptoras cujo status_rebanho ficou dessincronizado
-- do DG, por causa do bug em /api/salvar-embriao (marcava PRENHA_EMBRIAO sempre
-- que havia transfer, ignorando o resultado do diagnóstico).
--
-- Regra aplicada (mesma do código a partir de agora):
--   DG POSITIVO   → PRENHA_EMBRIAO
--   DG NEGATIVO   → VAZIA
--   DG AGUARDANDO → IMPLANTADA
--
-- Estados terminais (VENDIDA, MORTA, DESCARTE) e prenhezes já encerradas
-- (tipo_desfecho preenchido) NÃO são tocados.
--
-- Rodar no Supabase SQL Editor. Passo 1 é só conferência — rode antes do Passo 2.
-- ============================================================================

-- ── Passo 1: DIAGNÓSTICO (não altera nada) ──────────────────────────────────
-- Lista o DG mais recente de cada receptora e o status esperado vs. o atual.

WITH dg_atual AS (
  SELECT DISTINCT ON (t.receptora_id)
    t.receptora_id,
    pd.resultado,
    pd.data_dg,
    pd.tipo_desfecho
  FROM pregnancy_diagnoses pd
  JOIN transfers t ON t.id = pd.transfer_id
  WHERE t.receptora_id IS NOT NULL
    AND pd.tipo_desfecho IS NULL
  ORDER BY t.receptora_id, pd.data_dg DESC NULLS LAST, pd.id DESC
)
SELECT
  a.brinco,
  a.nome,
  a.status_rebanho                      AS status_atual,
  d.resultado                           AS dg,
  d.data_dg,
  CASE d.resultado
    WHEN 'POSITIVO'   THEN 'PRENHA_EMBRIAO'
    WHEN 'NEGATIVO'   THEN 'VAZIA'
    WHEN 'AGUARDANDO' THEN 'IMPLANTADA'
  END                                   AS status_esperado
FROM animals a
JOIN dg_atual d ON d.receptora_id = a.id
WHERE a.tipo = 'RECEPTORA'
  AND a.status_rebanho NOT IN ('VENDIDA', 'MORTA', 'DESCARTE')
  AND a.status_rebanho IS DISTINCT FROM CASE d.resultado
        WHEN 'POSITIVO'   THEN 'PRENHA_EMBRIAO'
        WHEN 'NEGATIVO'   THEN 'VAZIA'
        WHEN 'AGUARDANDO' THEN 'IMPLANTADA'
      END
ORDER BY a.brinco;


-- ── Passo 2: CORREÇÃO ───────────────────────────────────────────────────────
-- Rode só depois de conferir a lista do Passo 1.

WITH dg_atual AS (
  SELECT DISTINCT ON (t.receptora_id)
    t.receptora_id,
    pd.resultado
  FROM pregnancy_diagnoses pd
  JOIN transfers t ON t.id = pd.transfer_id
  WHERE t.receptora_id IS NOT NULL
    AND pd.tipo_desfecho IS NULL
  ORDER BY t.receptora_id, pd.data_dg DESC NULLS LAST, pd.id DESC
)
UPDATE animals a
SET status_rebanho = CASE d.resultado
      WHEN 'POSITIVO'   THEN 'PRENHA_EMBRIAO'
      WHEN 'NEGATIVO'   THEN 'VAZIA'
      WHEN 'AGUARDANDO' THEN 'IMPLANTADA'
    END
FROM dg_atual d
WHERE d.receptora_id = a.id
  AND a.tipo = 'RECEPTORA'
  AND a.status_rebanho NOT IN ('VENDIDA', 'MORTA', 'DESCARTE')
  AND d.resultado IN ('POSITIVO', 'NEGATIVO', 'AGUARDANDO')
  AND a.status_rebanho IS DISTINCT FROM CASE d.resultado
        WHEN 'POSITIVO'   THEN 'PRENHA_EMBRIAO'
        WHEN 'NEGATIVO'   THEN 'VAZIA'
        WHEN 'AGUARDANDO' THEN 'IMPLANTADA'
      END;


-- ── Passo 3: limpeza de previsão de parto em DG negativo ────────────────────
-- Previsão de parto só faz sentido em prenhez confirmada.

UPDATE pregnancy_diagnoses
SET data_previsao_parto = NULL
WHERE resultado = 'NEGATIVO'
  AND data_previsao_parto IS NOT NULL
  AND tipo_desfecho IS NULL;


-- ── Passo 4: conferência final ──────────────────────────────────────────────
SELECT status_rebanho, COUNT(*) AS total
FROM animals
WHERE tipo = 'RECEPTORA' AND is_external = FALSE
GROUP BY status_rebanho
ORDER BY total DESC;


-- ============================================================================
-- Passo 5: receptoras com status_rebanho NULL (legado da migração)
--
-- Sem status elas não recebem badge no /rebanho e somem dos filtros.
-- Como não têm DG ativo (senão o Passo 2 já teria resolvido), a classificação
-- depende do histórico: quem já passou por T.E. teve o ciclo encerrado; quem
-- nunca passou está disponível para entrar no programa. Ambos → VAZIA.
-- ============================================================================

-- ── 5a: DIAGNÓSTICO (não altera nada) ───────────────────────────────────────
-- Confira se alguma dessas deveria estar em outro estado (vendida, morta,
-- emprestada) antes de rodar o 5b.

SELECT
  a.brinco,
  a.nome,
  a.classificacao,
  a.localizacao,
  a.data_entrada,
  a.data_saida,
  COUNT(t.id)                                   AS total_tes,
  MAX(t.data_te)                                AS ultima_te,
  COUNT(pd.id) FILTER (WHERE pd.resultado = 'POSITIVO') AS dgs_positivos,
  MAX(pd.tipo_desfecho)                         AS ultimo_desfecho,
  a.observacoes
FROM animals a
LEFT JOIN transfers t            ON t.receptora_id = a.id
LEFT JOIN pregnancy_diagnoses pd ON pd.transfer_id = t.id
WHERE a.tipo = 'RECEPTORA'
  AND a.is_external = FALSE
  AND a.status_rebanho IS NULL
GROUP BY a.id, a.brinco, a.nome, a.classificacao, a.localizacao,
         a.data_entrada, a.data_saida, a.observacoes
ORDER BY total_tes DESC, a.brinco;


-- ── 5b: CORREÇÃO ────────────────────────────────────────────────────────────
-- Rode só depois de conferir o 5a. Ajuste manualmente antes as que você souber
-- que estão vendidas/mortas/emprestadas.

-- Animal com data_saida preenchida saiu do rebanho → não vira VAZIA.
UPDATE animals
SET status_rebanho = 'VENDIDA'
WHERE tipo = 'RECEPTORA'
  AND status_rebanho IS NULL
  AND data_saida IS NOT NULL;

-- Demais: disponíveis para novo ciclo.
UPDATE animals
SET status_rebanho = CASE
      WHEN classificacao = 'DESCARTE' THEN 'DESCARTE'
      ELSE 'VAZIA'
    END
WHERE tipo = 'RECEPTORA'
  AND status_rebanho IS NULL;


-- ── 5c: conferência ─────────────────────────────────────────────────────────
SELECT status_rebanho, COUNT(*) AS total
FROM animals
WHERE tipo = 'RECEPTORA' AND is_external = FALSE
GROUP BY status_rebanho
ORDER BY total DESC;
