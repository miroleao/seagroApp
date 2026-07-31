-- ============================================================
-- Limpeza de pesagens duplicadas   (PARTE 2 — APAGA DADOS)
-- ============================================================
--   ⚠  ESTE SCRIPT APAGA LINHAS. Rode só depois de conferir o
--      relatório de duplicatas da PARTE 1.
--
-- O QUE CONTA COMO DUPLICATA
--   Mesmo animal + mesma data + mesmo peso. Ou seja: o mesmo evento
--   registrado duas vezes. Duas pesagens do mesmo animal na mesma data
--   com pesos DIFERENTES não são tocadas — podem ser legítimas.
--
-- QUAL LINHA SOBREVIVE
--   A mais antiga (menor `criado_em`), preservando a observação original.
--
-- COMO USAR
--   Rode um passo de cada vez, conferindo o resultado antes de seguir.
-- ============================================================


-- ─── PASSO 1 — Ver exatamente o que será apagado ─────────────────────────────
--   Rode só isto primeiro. Cada linha aqui é uma que DESAPARECERÁ.

SELECT w.id,
       a.nome         AS animal,
       a.rgn,
       w.data,
       w.peso_kg,
       w.observacoes,
       w.criado_em
FROM (
  SELECT id, animal_id, data, peso_kg, observacoes, criado_em,
         ROW_NUMBER() OVER (
           PARTITION BY animal_id, data, peso_kg
           ORDER BY criado_em ASC, id ASC
         ) AS rn
  FROM weight_records
) w
JOIN animals a ON a.id = w.animal_id
WHERE w.rn > 1
ORDER BY w.data DESC, a.nome;


-- ─── PASSO 2 — Backup das linhas antes de apagar ─────────────────────────────
--   Cria uma cópia completa. Se algo der errado, dá pra restaurar.

CREATE TABLE IF NOT EXISTS weight_records_backup_dedupe AS
SELECT * FROM weight_records;

SELECT COUNT(*) AS linhas_no_backup FROM weight_records_backup_dedupe;


-- ─── PASSO 3 — Apagar as duplicatas ──────────────────────────────────────────
--   Descomente o bloco abaixo e rode.

/*
BEGIN;

DELETE FROM weight_records
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY animal_id, data, peso_kg
             ORDER BY criado_em ASC, id ASC
           ) AS rn
    FROM weight_records
  ) t
  WHERE t.rn > 1
);

COMMIT;
*/


-- ─── PASSO 4 — Índice UNIQUE (impede novas duplicatas no banco) ──────────────
--   Só funciona depois do PASSO 3. Descomente e rode.
--
--   Observação: o app já bloqueia duplicata exata no Server Action
--   `salvarPesagens`. Este índice é a mesma trava no nível do banco —
--   opcional, mas recomendado.

/*
CREATE UNIQUE INDEX IF NOT EXISTS weight_records_unq
  ON weight_records (animal_id, data, peso_kg);
*/


-- ─── PASSO 5 — Conferência final ─────────────────────────────────────────────
SELECT COUNT(*) AS duplicatas_restantes
FROM (
  SELECT animal_id, data, peso_kg
  FROM   weight_records
  GROUP  BY animal_id, data, peso_kg
  HAVING COUNT(*) > 1
) t;


-- ─── Restaurar, se precisar ──────────────────────────────────────────────────
-- BEGIN;
--   DELETE FROM weight_records;
--   INSERT INTO weight_records SELECT * FROM weight_records_backup_dedupe;
-- COMMIT;

-- ─── Descartar o backup, quando estiver confiante ────────────────────────────
-- DROP TABLE weight_records_backup_dedupe;
