-- Migration v2: adicionar PARIDA ao status_rebanho (Supabase usa text + CHECK constraint)
-- Rodar no Supabase SQL Editor

-- Passo 1: descobre o nome da constraint atual
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conrelid = 'animals'::regclass
  AND contype = 'c'
  AND conname ILIKE '%status_rebanho%';

-- Passo 2: remove a constraint antiga e recria com PARIDA incluído
-- (substitua "animals_status_rebanho_check" pelo nome encontrado no Passo 1, se diferente)
ALTER TABLE animals DROP CONSTRAINT IF EXISTS animals_status_rebanho_check;

ALTER TABLE animals
  ADD CONSTRAINT animals_status_rebanho_check
  CHECK (status_rebanho IN (
    'ATIVA', 'PRENHA_EMBRIAO', 'PRENHA_NATURAL', 'PRENHA',
    'FALHADA', 'VENDIDA', 'MORTA', 'VAZIA', 'PARIDA',
    'DESCARTE', 'PROTOCOLADA', 'INSEMINADA', 'IMPLANTADA'
  ));

-- Verificar se funcionou:
-- UPDATE animals SET status_rebanho = 'PARIDA' WHERE id = (SELECT id FROM animals LIMIT 1);
-- SELECT status_rebanho FROM animals ORDER BY id LIMIT 1;
-- (depois desfaça com UPDATE ... SET status_rebanho = valor_original)
