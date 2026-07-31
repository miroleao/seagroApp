-- ============================================================
-- Peso de nascimento em `animals`
-- ============================================================
-- CONTEXTO
--   A regra de ganho ponderal do projeto é:
--       (peso_atual - peso_nascimento) / dias_desde_nascimento × 1000
--
--   Só que `peso_nascimento` existia apenas na tabela `births`, e o
--   `registrarNascimento` gravava o valor em `animals.peso_atual` —
--   nunca como peso ao nascer. Sem essa coluna, o cálculo caía em
--   `peso_atual × 1000 / dias`, inflando o ponderal em ~90–100 g/dia.
--
-- O QUE ESTE SCRIPT FAZ
--   1. Cria a coluna `animals.peso_nascimento`
--   2. Importa os pesos reais já registrados em `births`
--   3. Preenche 30 kg (padrão Nelore) nos demais animais com data de nascimento
--
-- Rodar no Supabase SQL Editor.
-- ============================================================

BEGIN;

-- ── 1. Coluna ────────────────────────────────────────────────────────────────
ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS peso_nascimento NUMERIC(6,2);

COMMENT ON COLUMN animals.peso_nascimento IS
  'Peso ao nascer em kg. Base do cálculo de ganho ponderal. '
  'Padrão 30 kg quando não aferido — corrigir por animal quando houver o valor real.';

-- ── 2. Importa os pesos reais de `births` ────────────────────────────────────
--   Tem precedência sobre o padrão: é dado aferido.
UPDATE animals a
SET    peso_nascimento = b.peso_nascimento
FROM   births b
WHERE  b.animal_id = a.id
  AND  b.peso_nascimento IS NOT NULL
  AND  b.peso_nascimento > 0;

-- ── 3. Padrão de 30 kg para o restante ───────────────────────────────────────
--   Aplica a todo animal com data de nascimento — inclusive comprados,
--   já que o ponderal é calculado para qualquer um que tenha `nascimento`.
--   Animais sem data de nascimento ficam NULL: para eles o sistema usa o
--   ganho entre a primeira e a última pesagem, que não depende deste campo.
UPDATE animals
SET    peso_nascimento = 30
WHERE  peso_nascimento IS NULL
  AND  nascimento IS NOT NULL;

COMMIT;

-- ── 4. Conferência ───────────────────────────────────────────────────────────
SELECT
  CASE
    WHEN peso_nascimento IS NULL          THEN '3. sem peso (animal sem data de nascimento)'
    WHEN peso_nascimento = 30             THEN '2. padrao 30 kg'
    ELSE                                       '1. peso real importado de births'
  END                    AS origem,
  COUNT(*)               AS animais
FROM   animals
GROUP  BY 1
ORDER  BY 1;

-- ── 5. Animais cujo ponderal ficará sem cálculo ──────────────────────────────
--   Peso atual menor ou igual ao de nascimento indica dado inconsistente
--   (pesagem errada ou peso de nascimento alto demais). O app exibe "—".
SELECT id, nome, rgn, nascimento, peso_nascimento, peso_atual
FROM   animals
WHERE  peso_atual IS NOT NULL
  AND  peso_nascimento IS NOT NULL
  AND  peso_atual <= peso_nascimento
ORDER  BY nome;

-- ── Ajustar um animal específico, quando souber o peso real ──────────────────
-- UPDATE animals SET peso_nascimento = 34.5 WHERE rgn = 'SMEF 2';
