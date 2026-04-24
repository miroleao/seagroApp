-- =====================================================================
-- DIAGNÓSTICO DE SCHEMA — SE Agropecuária Nelore de Elite
-- Execute no Supabase: SQL Editor → New Query → Cole e clique Run
-- O resultado mostra o status de cada coluna: OK ou FALTANDO
-- =====================================================================

SELECT
  expected.tabela,
  expected.coluna,
  expected.migracao,
  CASE
    WHEN cols.column_name IS NOT NULL THEN '✅ OK'
    ELSE '❌ FALTANDO'
  END AS status
FROM (
  VALUES
    -- add_machos_fields.sql
    ('animals', 'exame_andrologico',        'add_machos_fields'),
    ('animals', 'data_exame_andrologico',   'add_machos_fields'),
    ('animals', 'veterinario_andrologico',  'add_machos_fields'),
    ('animals', 'laudo_andrologico',        'add_machos_fields'),
    ('animals', 'circunferencia_escrotal',  'add_machos_fields'),
    ('animals', 'data_ce',                  'add_machos_fields'),
    ('animals', 'rgd',                      'add_machos_fields'),

    -- add_genealogy_fields.sql
    ('animals', 'bisavo_materno',           'add_genealogy_fields'),
    ('animals', 'bisavo_materna',           'add_genealogy_fields'),

    -- add_rebanho_v2.sql
    ('animals', 'classificacao',            'add_rebanho_v2'),
    ('animals', 'data_entrada',             'add_rebanho_v2'),
    ('animals', 'forma_entrada',            'add_rebanho_v2'),
    ('animals', 'status_rebanho',           'add_rebanho_v2'),
    ('animals', 'peso_atual',               'add_rebanho_v2'),

    -- add_touro_prenhez.sql
    ('animals', 'touro_prenhez',            'add_touro_prenhez'),

    -- add_repro_fields.sql
    ('animals', 'rgd_touro_prenhez',        'add_repro_fields'),
    ('animals', 'data_inseminacao',         'add_repro_fields'),
    ('animals', 'touro_ultimo_parto',       'add_repro_fields'),
    ('animals', 'rgd_touro_ultimo_parto',   'add_repro_fields'),

    -- add_status_parto.sql
    ('animals', 'data_status',              'add_status_parto'),
    ('animals', 'numero_partos',            'add_status_parto'),
    ('animals', 'data_primeiro_parto',      'add_status_parto'),
    ('animals', 'data_ultimo_parto',        'add_status_parto'),

    -- add_congelamento.sql — opu_sessions
    ('opu_sessions', 'data_fiv',            'add_congelamento'),
    ('opu_sessions', 'data_dg',             'add_congelamento'),
    ('opu_sessions', 'data_sexagem',        'add_congelamento'),

    -- add_congelamento.sql — aspirations
    ('aspirations', 'doadora_rgn',          'add_congelamento'),
    ('aspirations', 'touro_rgn',            'add_congelamento'),
    ('aspirations', 'implantados',          'add_congelamento'),
    ('aspirations', 'prenhezes_count',      'add_congelamento'),
    ('aspirations', 'embrioes_dt',          'add_congelamento'),
    ('aspirations', 'embrioes_vitrificados','add_congelamento'),

    -- add_congelamento.sql — embryos
    ('embryos', 'tipo_congelamento',        'add_congelamento'),

    -- migration_doadora_id_transactions.sql
    ('transactions', 'doadora_id',          'migration_doadora_id_transactions')

) AS expected(tabela, coluna, migracao)
LEFT JOIN information_schema.columns cols
  ON cols.table_schema = 'public'
  AND cols.table_name  = expected.tabela
  AND cols.column_name = expected.coluna
ORDER BY
  CASE WHEN cols.column_name IS NULL THEN 0 ELSE 1 END,  -- faltando primeiro
  expected.migracao,
  expected.coluna;
