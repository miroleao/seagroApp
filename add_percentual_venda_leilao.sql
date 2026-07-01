-- ─── Migração: % vendido na Realização da Venda (Leilão) ───────────────────
-- Rode este arquivo no Supabase SQL Editor.
-- É seguro rodar mesmo que as colunas já existam (usa IF NOT EXISTS).
--
-- Contexto: na aba do animal, seção "Realização da Venda" (dentro do card
-- "Animal Para Leilão"), agora existe um campo "% Vendido" (100, 50, 33...),
-- pois nem sempre 100% do animal é vendido (sócios, cotas, etc.).
-- Esse valor é só informativo — não altera o valor financeiro registrado.

-- 1. animal_leilao_info: guarda o % informado na Realização da Venda
ALTER TABLE animal_leilao_info ADD COLUMN IF NOT EXISTS venda_percentual NUMERIC(5, 2);

-- 2. transactions: guarda o % do animal vendido nesta transação específica
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS percentual_vendido NUMERIC(5, 2) DEFAULT 100;

-- 3. Verificação
SELECT column_name FROM information_schema.columns
WHERE table_name = 'animal_leilao_info' AND column_name = 'venda_percentual';

SELECT column_name FROM information_schema.columns
WHERE table_name = 'transactions' AND column_name = 'percentual_vendido';
