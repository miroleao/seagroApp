-- Adiciona campos de venda ao card "Para Leilão"
-- Rodar no Supabase SQL Editor

ALTER TABLE animal_leilao_info
  ADD COLUMN IF NOT EXISTS venda_comprador     TEXT,
  ADD COLUMN IF NOT EXISTS venda_valor_parcela NUMERIC,
  ADD COLUMN IF NOT EXISTS venda_n_parcelas    INTEGER;
