-- Corrige o número de partos da VELASHI I-II-ML FIV CGAL
-- Ela teve apenas 1 parto (10/04/2026) — corrige contagem incorreta de 3 para 1

UPDATE animals
SET
  numero_partos      = 1,
  data_primeiro_parto = '2026-04-10',
  data_ultimo_parto   = '2026-04-10'
WHERE rgn ILIKE '%CGAL 3070%';

-- Confirma o resultado:
SELECT nome, rgn, numero_partos, data_primeiro_parto, data_ultimo_parto
FROM animals
WHERE rgn ILIKE '%CGAL 3070%';
