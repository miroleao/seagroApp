-- Adiciona coluna data_te (Data da T.E.) à tabela opu_sessions
-- Rodar no Supabase SQL Editor

ALTER TABLE opu_sessions
ADD COLUMN IF NOT EXISTS data_te DATE;
