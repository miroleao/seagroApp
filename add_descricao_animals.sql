-- ============================================================
-- Campo de texto livre por animal (Observações da ficha)
-- ============================================================
-- CONTEXTO
--   `animals.observacoes` já existe, mas é usado como registro operacional:
--   ao lançar óbito ou venda, o desfecho GRAVA POR CIMA dele com a causa e a
--   data. Um texto descritivo escrito ali seria apagado no primeiro desfecho.
--
--   Por isso o texto editorial ganha coluna própria:
--     · descricao   → texto livre do usuário (genealogia, prêmios, histórico)
--     · observacoes → segue como log operacional do sistema
--
--   `descricao` é o que sai na seção Observações do PDF da ficha, que é o
--   arquivo enviado a assessoria de leilão e comprador.
--
-- Rodar no Supabase SQL Editor.
-- ============================================================

ALTER TABLE animals
  ADD COLUMN IF NOT EXISTS descricao TEXT;

COMMENT ON COLUMN animals.descricao IS
  'Texto livre sobre o animal, escrito na ficha: genealogia, premiações, '
  'histórico comercial. Sai no PDF da ficha. Não é tocado por desfechos.';

-- ── Conferência ──────────────────────────────────────────────────────────────
SELECT column_name, data_type
FROM   information_schema.columns
WHERE  table_name = 'animals'
  AND  column_name IN ('descricao', 'observacoes')
ORDER  BY column_name;
