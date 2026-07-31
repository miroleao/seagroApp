-- ============================================================
-- Unificação: pesagens → weight_records   (PARTE 1 — SEGURA)
-- ============================================================
-- CONTEXTO
--   O app tem duas tabelas com o mesmo papel:
--     · weight_records — lida por /pesagens, /doadoras/[id], /machos/[id], /relatorios
--     · pesagens       — gravada pela ficha do rebanho (FichaPesagemForm)
--   Resultado: pesagens lançadas na ficha de uma receptora/nascido nunca
--   apareciam na aba Pesagens.
--
-- O QUE ESTE SCRIPT FAZ
--   1. Copia para weight_records os registros de `pesagens` que ainda não existem lá
--   2. Cria índices de performance
--   3. Recalcula animals.peso_atual com a pesagem mais recente
--   4. Lista as duplicatas que sobraram (só relatório — não apaga nada)
--
-- O QUE ESTE SCRIPT **NÃO** FAZ
--   · Não apaga nenhuma linha
--   · Não cria índice UNIQUE (isso exige limpar duplicatas antes — ver PARTE 2,
--     no arquivo dedupe_weight_records.sql)
--   · Não apaga a tabela `pesagens` — ela fica intacta como backup
--
-- Rodar no Supabase SQL Editor.
-- ============================================================

BEGIN;

-- ── 1. Migra os registros ausentes ───────────────────────────────────────────
--   DISTINCT ON garante que, se a própria tabela `pesagens` tiver linhas
--   idênticas, apenas uma seja copiada.
INSERT INTO weight_records (farm_id, animal_id, data, peso_kg, observacoes, criado_em)
SELECT DISTINCT ON (p.animal_id, p.data, p.peso_kg)
       p.farm_id,
       p.animal_id,
       p.data,
       p.peso_kg,
       p.observacoes,
       p.criado_em
FROM   pesagens p
WHERE  NOT EXISTS (
         SELECT 1
         FROM   weight_records w
         WHERE  w.animal_id = p.animal_id
           AND  w.data      = p.data
           AND  w.peso_kg   = p.peso_kg
       )
ORDER  BY p.animal_id, p.data, p.peso_kg, p.criado_em;

-- ── 2. Índices de performance ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS weight_records_animal_idx
  ON weight_records (animal_id, data DESC);

CREATE INDEX IF NOT EXISTS weight_records_farm_idx
  ON weight_records (farm_id);

-- ── 3. Recalcula peso_atual com a pesagem mais recente ───────────────────────
UPDATE animals a
SET    peso_atual = sub.peso_kg
FROM (
  SELECT DISTINCT ON (animal_id) animal_id, peso_kg
  FROM   weight_records
  ORDER  BY animal_id, data DESC, criado_em DESC
) sub
WHERE a.id = sub.animal_id
  AND (a.peso_atual IS DISTINCT FROM sub.peso_kg);

COMMIT;

-- ── 4. Conferência ───────────────────────────────────────────────────────────
SELECT 'pesagens (origem)'        AS tabela, COUNT(*)::TEXT AS registros FROM pesagens
UNION ALL
SELECT 'weight_records (destino)', COUNT(*)::TEXT           FROM weight_records;

-- ── 5. Duplicatas existentes (RELATÓRIO — nada é apagado) ────────────────────
--   Se esta consulta voltar linhas, o app continua funcionando normalmente:
--   a pesagem só aparece repetida no histórico do animal.
--   Para limpar, revise o resultado e rode `dedupe_weight_records.sql`.
SELECT a.nome        AS animal,
       a.rgn,
       w.data,
       w.peso_kg,
       COUNT(*)      AS vezes_repetida
FROM   weight_records w
JOIN   animals a ON a.id = w.animal_id
GROUP  BY a.nome, a.rgn, w.data, w.peso_kg
HAVING COUNT(*) > 1
ORDER  BY w.data DESC, a.nome;

-- ── 6. Limpeza da tabela antiga (SÓ DEPOIS DE CONFERIR — rodar manualmente) ──
-- DROP TABLE pesagens;
