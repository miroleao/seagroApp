-- Migration: adicionar valor PARIDA ao status_rebanho
-- Rodar no Supabase SQL Editor

-- Se status_rebanho for um tipo ENUM PostgreSQL:
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'status_rebanho'
  ) THEN
    ALTER TYPE status_rebanho ADD VALUE IF NOT EXISTS 'PARIDA';
  END IF;
END$$;

-- Se for uma coluna text com CHECK constraint, rodar também:
-- (o Supabase geralmente usa text + check, não enum nativo)
-- Nesse caso, basta inserir um animal com status_rebanho = 'PARIDA' via código
-- que o Postgres aceitará se não houver constraint rígida.
-- Se der erro de constraint, rode:
--
-- ALTER TABLE animals DROP CONSTRAINT IF EXISTS animals_status_rebanho_check;
-- ALTER TABLE animals ADD CONSTRAINT animals_status_rebanho_check
--   CHECK (status_rebanho IN (
--     'ATIVA','PRENHA_EMBRIAO','PRENHA_NATURAL','FALHADA','VENDIDA','MORTA',
--     'VAZIA','PARIDA','DESCARTE','PROTOCOLADA','INSEMINADA','IMPLANTADA','PRENHA'
--   ));
