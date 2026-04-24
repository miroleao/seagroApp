-- ============================================================
--  SE AGROPECUÁRIA NELORE DE ELITE
--  Script SQL v2 — Módulo de Pista, Premiações e Alertas
--  Versão 1.0 | Março 2026
--
--  EXECUTE ESTE ARQUIVO APÓS O supabase_schema.sql
--
--  Fonte das categorias e pesos:
--  Regulamento dos Rankings Nacionais e Regionais da Raça
--  Nelore (2025/2026) — ACNB, Edição 01 - Outubro 2025
--  Artigos 29° e 23° + ANEXO XII
-- ============================================================


-- ============================================================
-- BLOCO A — COBERTURAS NATURAIS
-- (complementa FIV/TE para fechar o ciclo de gestações)
-- ============================================================

CREATE TABLE natural_coverings (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id             UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    femea_id            UUID REFERENCES animals(id),        -- Doadora ou receptora
    femea_nome          TEXT,
    touro_id            UUID REFERENCES animals(id),
    touro_nome          TEXT,
    data_cobertura      DATE NOT NULL,
    tipo                TEXT DEFAULT 'MONTA_NATURAL'
                            CHECK (tipo IN ('MONTA_NATURAL', 'INSEMINACAO_ARTIFICIAL')),
    resultado_dg        TEXT CHECK (resultado_dg IN (
                            'POSITIVO', 'VAZIO', 'AGUARDANDO', 'ABSORVEU', 'ABORTOU'
                        )),
    data_dg             DATE,
    data_previsao_parto DATE
                            GENERATED ALWAYS AS (data_cobertura + INTERVAL '285 days') STORED,
    data_parto_real     DATE,
    observacoes         TEXT,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE natural_coverings IS
    'Coberturas naturais e IAs (sem TE). Complementa transfers para o cálculo de alertas de parto.';

ALTER TABLE natural_coverings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    EXECUTE '
        CREATE POLICY "natural_coverings_own" ON natural_coverings
        USING (farm_id = auth_farm_id())
        WITH CHECK (farm_id = auth_farm_id())';
END $$;

CREATE INDEX idx_natural_coverings_farm    ON natural_coverings(farm_id);
CREATE INDEX idx_natural_coverings_femea   ON natural_coverings(femea_id) WHERE femea_id IS NOT NULL;
CREATE INDEX idx_natural_coverings_parto   ON natural_coverings(data_previsao_parto)
                                               WHERE resultado_dg = 'POSITIVO';


-- ============================================================
-- BLOCO B — EXPOSIÇÕES (cada show com data-base)
-- ============================================================

CREATE TABLE exhibitions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    nome            TEXT NOT NULL,                  -- Ex: "ExpoZebu 2026"
    data_base       DATE NOT NULL,                  -- Data-base para cálculo de idade
    data_inicio     DATE,
    data_fim        DATE,
    local           TEXT,
    cidade          TEXT,
    estado          TEXT,
    organizador     TEXT,                           -- Ex: "ACNB", "Associação Regional"
    tipo            TEXT DEFAULT 'OFICIAL'
                        CHECK (tipo IN ('OFICIAL', 'OURO', 'EXPOINEL', 'REGIONAL', 'LIVRE')),
    observacoes     TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE exhibitions IS
    'Exposições/feiras nas quais animais da fazenda participam. data_base define a idade de cada animal para fins de categoria.';

ALTER TABLE exhibitions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    EXECUTE '
        CREATE POLICY "exhibitions_own" ON exhibitions
        USING (farm_id = auth_farm_id())
        WITH CHECK (farm_id = auth_farm_id())';
END $$;

CREATE INDEX idx_exhibitions_farm      ON exhibitions(farm_id);
CREATE INDEX idx_exhibitions_data_base ON exhibitions(data_base);


-- ============================================================
-- BLOCO C — GRUPOS DE CAMPEONATO (estrutura fixa do regulamento)
-- Fonte: Artigo 29° do Regulamento ACNB 2025/2026
-- ============================================================

CREATE TABLE championship_groups (
    id                  SERIAL PRIMARY KEY,
    grupo_nelore        TEXT NOT NULL,              -- Ex: 'NELORE' | 'NELORE_MOCHO' | 'AMBOS'
    nome                TEXT NOT NULL,              -- Ex: 'Bezerro Menor', 'Novilha Maior'
    sexo                TEXT NOT NULL CHECK (sexo IN ('M', 'F')),
    idade_min_meses     NUMERIC(5,2) NOT NULL,      -- Início da faixa (meses, inclusivo)
    idade_max_meses     NUMERIC(5,2) NOT NULL,      -- Fim da faixa (meses, exclusivo para o seguinte)
    descricao           TEXT
);

COMMENT ON TABLE championship_groups IS
    'Grupos de campeonato conforme Artigo 29° do Regulamento ACNB. Tabela global (sem farm_id).';

-- ─── Nelore — Machos ──────────────────────────────────────────
INSERT INTO championship_groups
    (grupo_nelore, nome, sexo, idade_min_meses, idade_max_meses, descricao)
VALUES
    ('NELORE', 'Bezerro Menor',  'M',  6,  9,  'Machos de 6 a 9 meses'),
    ('NELORE', 'Bezerro Maior',  'M',  9,  12, 'Machos de 9 a 12 meses'),
    ('NELORE', 'Júnior Menor',   'M', 12,  16, 'Machos de 12 a 16 meses'),
    ('NELORE', 'Júnior',         'M', 16,  20, 'Machos de 16 a 20 meses'),
    ('NELORE', 'Júnior Maior',   'M', 20,  24, 'Machos de 20 a 24 meses'),
    ('NELORE', 'Touro Jovem',    'M', 24,  30, 'Machos de 24 a 30 meses'),
    ('NELORE', 'Touro Sênior',   'M', 30,  36, 'Machos de 30 a 36 meses'),
-- ─── Nelore — Fêmeas ─────────────────────────────────────────
    ('NELORE', 'Bezerra Menor',  'F',  6,  9,  'Fêmeas de 6 a 9 meses'),
    ('NELORE', 'Bezerra Maior',  'F',  9,  12, 'Fêmeas de 9 a 12 meses'),
    ('NELORE', 'Novilha Menor',  'F', 12,  16, 'Fêmeas de 12 a 16 meses'),
    ('NELORE', 'Novilha',        'F', 16,  20, 'Fêmeas de 16 a 20 meses'),
    ('NELORE', 'Novilha Maior',  'F', 20,  24, 'Fêmeas de 20 a 24 meses'),
    ('NELORE', 'Vaca Jovem',     'F', 24,  30, 'Fêmeas de 24 a 30 meses'),
    ('NELORE', 'Vaca',           'F', 30,  36, 'Fêmeas de 30 a 36 meses'),
    ('NELORE', 'Vaca Adulta',    'F', 36,  42, 'Fêmeas de 36 a 42 meses'),
-- ─── Nelore Mocho — Machos ────────────────────────────────────
    ('NELORE_MOCHO', 'Bezerro Menor',  'M',  6,  9,  'Machos Mocho de 6 a 9 meses'),
    ('NELORE_MOCHO', 'Bezerro Maior',  'M',  9,  12, 'Machos Mocho de 9 a 12 meses'),
    ('NELORE_MOCHO', 'Júnior Menor',   'M', 12,  16, 'Machos Mocho de 12 a 16 meses'),
    ('NELORE_MOCHO', 'Júnior',         'M', 16,  20, 'Machos Mocho de 16 a 20 meses'),
    ('NELORE_MOCHO', 'Júnior Maior',   'M', 20,  24, 'Machos Mocho de 20 a 24 meses'),
    ('NELORE_MOCHO', 'Touro Jovem',    'M', 24,  30, 'Machos Mocho de 24 a 30 meses'),
    ('NELORE_MOCHO', 'Touro Sênior',   'M', 30,  36, 'Machos Mocho de 30 a 36 meses'),
-- ─── Nelore Mocho — Fêmeas ───────────────────────────────────
    ('NELORE_MOCHO', 'Bezerra Menor',  'F',  6,  9,  'Fêmeas Mocho de 6 a 9 meses'),
    ('NELORE_MOCHO', 'Bezerra Maior',  'F',  9,  12, 'Fêmeas Mocho de 9 a 12 meses'),
    ('NELORE_MOCHO', 'Novilha Menor',  'F', 12,  16, 'Fêmeas Mocho de 12 a 16 meses'),
    ('NELORE_MOCHO', 'Novilha',        'F', 16,  20, 'Fêmeas Mocho de 16 a 20 meses'),
    ('NELORE_MOCHO', 'Novilha Maior',  'F', 20,  24, 'Fêmeas Mocho de 20 a 24 meses'),
    ('NELORE_MOCHO', 'Vaca Jovem',     'F', 24,  30, 'Fêmeas Mocho de 24 a 30 meses'),
    ('NELORE_MOCHO', 'Vaca',           'F', 30,  36, 'Fêmeas Mocho de 30 a 36 meses'),
    ('NELORE_MOCHO', 'Vaca Adulta',    'F', 36,  48, 'Fêmeas Mocho de 36 a 48 meses (ACE 2025/26)');


-- ============================================================
-- BLOCO D — CATEGORIAS DE PISTA (subdivisões dentro de cada grupo)
-- Fonte: Artigo 29° e Artigo 23° do Regulamento ACNB 2025/2026
-- Pesos máximos: ANEXO XII do regulamento (ao início de cada mês)
-- Pesos mínimos: Tabela ABCZ (preencher via sistema quando disponível)
-- ============================================================

CREATE TABLE show_categories (
    id                      SERIAL PRIMARY KEY,
    championship_group_id   INTEGER NOT NULL REFERENCES championship_groups(id),

    -- Identificação da categoria
    numero_categoria        INTEGER NOT NULL,           -- 1, 2, 3, 4...
    nome_categoria          TEXT NOT NULL,              -- '1ª Categoria', '2ª Categoria'...

    -- Faixa etária EXATA (em meses, fracionados para facilitar cálculos)
    -- Regra: animal com N meses e 0 dias até N+k meses e 0 dias
    idade_min_meses_exato   NUMERIC(5,2) NOT NULL,     -- Início inclusivo (ex: 12.0)
    idade_max_meses_exato   NUMERIC(5,2) NOT NULL,     -- Fim exclusivo (ex: 13.0)

    -- Pesos de referência (kg) ao início da faixa etária
    -- Fonte: ANEXO XII — valores na linha "0 dia" do mês correspondente
    peso_max_ref_kg         NUMERIC(7,2),              -- Peso máximo NELORE (machos/fêmeas)
    peso_max_mocho_kg       NUMERIC(7,2),              -- Peso máximo NELORE MOCHO
    peso_min_kg             NUMERIC(7,2),              -- Peso mínimo ABCZ (preencher quando disponível)

    observacoes             TEXT,
    UNIQUE (championship_group_id, numero_categoria)
);

COMMENT ON TABLE show_categories IS
    'Categorias individuais dentro de cada grupo de campeonato. '
    'peso_max_ref_kg e peso_max_mocho_kg vêm do ANEXO XII do Regulamento ACNB 2025/2026.';

-- ─────────────────────────────────────────────────────────────
-- MACHOS NELORE — Bezerro Menor (grupo 1: 6–9 meses)
-- Pesos máx ao 0 dia do mês (ANEXO XII, Nelore Machos)
-- ─────────────────────────────────────────────────────────────
INSERT INTO show_categories
    (championship_group_id, numero_categoria, nome_categoria,
     idade_min_meses_exato, idade_max_meses_exato,
     peso_max_ref_kg, peso_max_mocho_kg)
VALUES
    (1, 1, '1ª Categoria',  6,  7, 328, 328),
    (1, 2, '2ª Categoria',  7,  8, 375, 375),
    (1, 3, '3ª Categoria',  8,  9, 420, 420);

-- Machos Nelore — Bezerro Maior (grupo 2: 9–12 meses)
INSERT INTO show_categories
    (championship_group_id, numero_categoria, nome_categoria,
     idade_min_meses_exato, idade_max_meses_exato,
     peso_max_ref_kg, peso_max_mocho_kg)
VALUES
    (2, 1, '1ª Categoria',  9, 10, 465, 465),
    (2, 2, '2ª Categoria', 10, 11, 510, 510),
    (2, 3, '3ª Categoria', 11, 12, 553, 553);

-- Machos Nelore — Júnior Menor (grupo 3: 12–16 meses)
INSERT INTO show_categories
    (championship_group_id, numero_categoria, nome_categoria,
     idade_min_meses_exato, idade_max_meses_exato,
     peso_max_ref_kg, peso_max_mocho_kg)
VALUES
    (3, 1, '1ª Categoria', 12, 13, 595, 595),
    (3, 2, '2ª Categoria', 13, 14, 636, 636),
    (3, 3, '3ª Categoria', 14, 15, 677, 677),
    (3, 4, '4ª Categoria', 15, 16, 717, 717);

-- Machos Nelore — Júnior (grupo 4: 16–20 meses)
INSERT INTO show_categories
    (championship_group_id, numero_categoria, nome_categoria,
     idade_min_meses_exato, idade_max_meses_exato,
     peso_max_ref_kg, peso_max_mocho_kg)
VALUES
    (4, 1, '1ª Categoria', 16, 17, 755, 755),
    (4, 2, '2ª Categoria', 17, 18, 793, 793),
    (4, 3, '3ª Categoria', 18, 19, 830, 830),
    (4, 4, '4ª Categoria', 19, 20, 866, 866);

-- Machos Nelore — Júnior Maior (grupo 5: 20–24 meses)
INSERT INTO show_categories
    (championship_group_id, numero_categoria, nome_categoria,
     idade_min_meses_exato, idade_max_meses_exato,
     peso_max_ref_kg, peso_max_mocho_kg)
VALUES
    (5, 1, '1ª Categoria', 20, 21, 901, 901),
    (5, 2, '2ª Categoria', 21, 22, NULL, NULL),  -- Tabela vai além dos 20 meses; preencher
    (5, 3, '3ª Categoria', 22, 23, NULL, NULL),
    (5, 4, '4ª Categoria', 23, 24, NULL, NULL);

-- Machos Nelore — Touro Jovem (grupo 6: 24–30 meses)
INSERT INTO show_categories
    (championship_group_id, numero_categoria, nome_categoria,
     idade_min_meses_exato, idade_max_meses_exato)
VALUES
    (6, 1, '1ª Categoria', 24, 26),
    (6, 2, '2ª Categoria', 26, 28),
    (6, 3, '3ª Categoria', 28, 30);

-- Machos Nelore — Touro Sênior (grupo 7: 30–36 meses)
INSERT INTO show_categories
    (championship_group_id, numero_categoria, nome_categoria,
     idade_min_meses_exato, idade_max_meses_exato)
VALUES
    (7, 1, '1ª Categoria', 30, 32),
    (7, 2, '2ª Categoria', 32, 34),
    (7, 3, '3ª Categoria', 34, 36);

-- ─────────────────────────────────────────────────────────────
-- FÊMEAS NELORE — Bezerra Menor (grupo 8: 6–9 meses)
-- Pesos máximos ao 0 dia do mês (ANEXO XII, Nelore Fêmeas)
-- ─────────────────────────────────────────────────────────────
INSERT INTO show_categories
    (championship_group_id, numero_categoria, nome_categoria,
     idade_min_meses_exato, idade_max_meses_exato,
     peso_max_ref_kg, peso_max_mocho_kg)
VALUES
    (8,  1, '1ª Categoria',  6,  7, 301, 301),
    (8,  2, '2ª Categoria',  7,  8, 343, 343),
    (8,  3, '3ª Categoria',  8,  9, 384, 384);

-- Fêmeas Nelore — Bezerra Maior (grupo 9: 9–12 meses)
INSERT INTO show_categories
    (championship_group_id, numero_categoria, nome_categoria,
     idade_min_meses_exato, idade_max_meses_exato,
     peso_max_ref_kg, peso_max_mocho_kg)
VALUES
    (9,  1, '1ª Categoria',  9, 10, 425, 425),
    (9,  2, '2ª Categoria', 10, 11, 465, 465),
    (9,  3, '3ª Categoria', 11, 12, 503, 503);

-- Fêmeas Nelore — Novilha Menor (grupo 10: 12–16 meses)
INSERT INTO show_categories
    (championship_group_id, numero_categoria, nome_categoria,
     idade_min_meses_exato, idade_max_meses_exato,
     peso_max_ref_kg, peso_max_mocho_kg)
VALUES
    (10, 1, '1ª Categoria', 12, 13, 541, 541),
    (10, 2, '2ª Categoria', 13, 14, 578, 578),
    (10, 3, '3ª Categoria', 14, 15, 614, 614),
    (10, 4, '4ª Categoria', 15, 16, 649, 649);

-- Fêmeas Nelore — Novilha (grupo 11: 16–20 meses)
INSERT INTO show_categories
    (championship_group_id, numero_categoria, nome_categoria,
     idade_min_meses_exato, idade_max_meses_exato,
     peso_max_ref_kg, peso_max_mocho_kg)
VALUES
    (11, 1, '1ª Categoria', 16, 17, 683, 683),
    (11, 2, '2ª Categoria', 17, 18, 717, 717),
    (11, 3, '3ª Categoria', 18, 19, 749, 749),
    (11, 4, '4ª Categoria', 19, 20, 780, 780);

-- Fêmeas Nelore — Novilha Maior (grupo 12: 20–24 meses)
INSERT INTO show_categories
    (championship_group_id, numero_categoria, nome_categoria,
     idade_min_meses_exato, idade_max_meses_exato,
     peso_max_ref_kg, peso_max_mocho_kg)
VALUES
    (12, 1, '1ª Categoria', 20, 21, 811, 811),
    (12, 2, '2ª Categoria', 21, 22, NULL, NULL),
    (12, 3, '3ª Categoria', 22, 23, NULL, NULL),
    (12, 4, '4ª Categoria', 23, 24, NULL, NULL);

-- Fêmeas Nelore — Vaca Jovem (grupo 13: 24–30 meses)
INSERT INTO show_categories
    (championship_group_id, numero_categoria, nome_categoria,
     idade_min_meses_exato, idade_max_meses_exato)
VALUES
    (13, 1, '1ª Categoria', 24, 26),
    (13, 2, '2ª Categoria', 26, 28),
    (13, 3, '3ª Categoria', 28, 30);

-- Fêmeas Nelore — Vaca (grupo 14: 30–36 meses)
INSERT INTO show_categories
    (championship_group_id, numero_categoria, nome_categoria,
     idade_min_meses_exato, idade_max_meses_exato)
VALUES
    (14, 1, '1ª Categoria', 30, 32),
    (14, 2, '2ª Categoria', 32, 34),
    (14, 3, '3ª Categoria', 34, 36);

-- Fêmeas Nelore — Vaca Adulta (grupo 15: 36–42 meses)
INSERT INTO show_categories
    (championship_group_id, numero_categoria, nome_categoria,
     idade_min_meses_exato, idade_max_meses_exato)
VALUES
    (15, 1, '1ª Categoria', 36, 38),
    (15, 2, '2ª Categoria', 38, 40),
    (15, 3, '3ª Categoria', 40, 42);

-- (Grupos 16–30 são Nelore Mocho — mesmas categorias, inserir se necessário)


-- ============================================================
-- BLOCO E — FUNÇÃO: calcular categoria de um animal numa exposição
-- Uso: SELECT * FROM get_animal_show_category(animal_id, exhibition_id);
-- ============================================================

CREATE OR REPLACE FUNCTION get_animal_show_category(
    p_animal_id  UUID,
    p_exhibition_id UUID
)
RETURNS TABLE (
    grupo_nelore        TEXT,
    campeonato          TEXT,
    numero_categoria    INTEGER,
    nome_categoria      TEXT,
    idade_na_data_base  NUMERIC,    -- Idade em meses (com decimais)
    peso_max_ref_kg     NUMERIC,
    peso_min_kg         NUMERIC
) AS $$
DECLARE
    v_nascimento    DATE;
    v_sexo          TEXT;
    v_data_base     DATE;
    v_idade_meses   NUMERIC;
BEGIN
    -- Busca dados do animal e da exposição
    SELECT a.nascimento, a.sexo
      INTO v_nascimento, v_sexo
      FROM animals a WHERE a.id = p_animal_id;

    SELECT e.data_base
      INTO v_data_base
      FROM exhibitions e WHERE e.id = p_exhibition_id;

    -- Calcula idade em meses na data-base
    v_idade_meses :=
        EXTRACT(YEAR FROM AGE(v_data_base, v_nascimento)) * 12 +
        EXTRACT(MONTH FROM AGE(v_data_base, v_nascimento)) +
        EXTRACT(DAY FROM AGE(v_data_base, v_nascimento)) / 30.0;

    -- Retorna as categorias compatíveis
    RETURN QUERY
    SELECT
        cg.grupo_nelore,
        cg.nome            AS campeonato,
        sc.numero_categoria,
        sc.nome_categoria,
        ROUND(v_idade_meses::NUMERIC, 2) AS idade_na_data_base,
        sc.peso_max_ref_kg,
        sc.peso_min_kg
    FROM show_categories sc
    JOIN championship_groups cg ON cg.id = sc.championship_group_id
    WHERE cg.sexo = v_sexo
      AND v_idade_meses >= sc.idade_min_meses_exato
      AND v_idade_meses <  sc.idade_max_meses_exato
    ORDER BY cg.grupo_nelore;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_animal_show_category IS
    'Retorna o grupo de campeonato e categoria de um animal numa exposição, '
    'calculando a idade na data-base. Pode retornar múltiplas linhas (uma por grupo: Nelore, Nelore Mocho).';


-- ============================================================
-- BLOCO F — INSCRIÇÕES DE ANIMAIS EM EXPOSIÇÕES
-- ============================================================

CREATE TABLE animal_show_entries (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id                 UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    animal_id               UUID NOT NULL REFERENCES animals(id),
    exhibition_id           UUID NOT NULL REFERENCES exhibitions(id),

    -- Categoria (calculada pela função ou selecionada manualmente)
    championship_group_id   INTEGER REFERENCES championship_groups(id),
    show_category_id        INTEGER REFERENCES show_categories(id),
    grupo_nelore            TEXT DEFAULT 'NELORE'
                                CHECK (grupo_nelore IN ('NELORE','NELORE_MOCHO','NELORE_PELAGENS')),

    -- Idade e peso na data-base
    idade_meses_na_data_base  NUMERIC(5,2),           -- Calculado pela app
    peso_na_data_base_kg      NUMERIC(7,2),           -- Peso aferido na data-base

    -- Situação da inscrição
    numero_catalogo         TEXT,                     -- Nº do catálogo da exposição
    status                  TEXT DEFAULT 'INSCRITO'
                                CHECK (status IN ('INSCRITO','PARTICIPOU','AUSENTE','RETIRADO')),
    observacoes             TEXT,
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (animal_id, exhibition_id, grupo_nelore)   -- Um animal por grupo por exposição
);

COMMENT ON TABLE animal_show_entries IS
    'Inscrição de um animal em uma exposição específica. '
    'peso_na_data_base_kg deve ser preenchido após a pesagem oficial.';

ALTER TABLE animal_show_entries ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    EXECUTE '
        CREATE POLICY "animal_show_entries_own" ON animal_show_entries
        USING (farm_id = auth_farm_id())
        WITH CHECK (farm_id = auth_farm_id())';
END $$;

CREATE INDEX idx_show_entries_farm       ON animal_show_entries(farm_id);
CREATE INDEX idx_show_entries_animal     ON animal_show_entries(animal_id);
CREATE INDEX idx_show_entries_exhibition ON animal_show_entries(exhibition_id);


-- ============================================================
-- BLOCO G — PREMIAÇÕES
-- ============================================================

CREATE TABLE awards (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id             UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    animal_id           UUID NOT NULL REFERENCES animals(id),
    show_entry_id       UUID REFERENCES animal_show_entries(id),

    -- Identificação da premiação
    exhibition_id       UUID REFERENCES exhibitions(id),  -- Atalho direto (sem precisar do entry)
    grupo_nelore        TEXT CHECK (grupo_nelore IN ('NELORE','NELORE_MOCHO','NELORE_PELAGENS')),

    -- Prêmio conquistado (conforme Artigo 29° e 30° do Regulamento ACNB)
    tipo_premio         TEXT NOT NULL
                            CHECK (tipo_premio IN (
                                -- Prêmios de categoria (Artigo 29°)
                                '1_LUGAR', '2_LUGAR', '3_LUGAR', '4_LUGAR',
                                '5_LUGAR', '6_LUGAR', '7_LUGAR', '8_LUGAR',
                                '9_LUGAR', '10_LUGAR', '11_LUGAR', '12_LUGAR',
                                -- Títulos de campeonato (Artigo 30°)
                                'CAMPEA', 'RESERVADA_CAMPEA', '3_MELHOR',
                                'CAMPEAO', 'RESERVADO_CAMPEAO', '3_MELHOR_MACHO',
                                -- Grande campeonato (Artigo 31°)
                                'GRANDE_CAMPEA', 'RESERVADA_GRANDE_CAMPEA', '3_GRANDE_CAMPEA',
                                'GRANDE_CAMPEAO', 'RESERVADO_GRANDE_CAMPEAO', '3_GRANDE_CAMPEAO',
                                -- Conjuntos Progênie (Artigo 32°)
                                'CONJUNTO_PROGENIE_MAE_CAMPEAO',
                                'CONJUNTO_PROGENIE_MAE_RESERVADO',
                                'CONJUNTO_PROGENIE_PAI_CAMPEAO',
                                'CONJUNTO_PROGENIE_PAI_RESERVADO',
                                -- Outros
                                'OUTRO'
                            )),
    descricao_premio    TEXT,  -- Texto livre para detalhes (ex: "3ª Melhor Novilha Maior")

    -- Categoria e campeonato onde a premiação foi conquistada
    championship_group_id INTEGER REFERENCES championship_groups(id),
    show_category_id      INTEGER REFERENCES show_categories(id),

    -- Pontuação (conforme Tabela I de Índices de Bonificação)
    pontos_obtidos      NUMERIC(8,2),
    jurado              TEXT,
    foto_url            TEXT,                         -- Foto do troféu/premiação
    observacoes         TEXT,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE awards IS
    'Premiações conquistadas por animais em exposições. '
    'tipo_premio segue nomenclatura do Artigo 29° e 30° do Regulamento ACNB 2025/2026.';

ALTER TABLE awards ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    EXECUTE '
        CREATE POLICY "awards_own" ON awards
        USING (farm_id = auth_farm_id())
        WITH CHECK (farm_id = auth_farm_id())';
END $$;

CREATE INDEX idx_awards_farm       ON awards(farm_id);
CREATE INDEX idx_awards_animal     ON awards(animal_id);
CREATE INDEX idx_awards_exhibition ON awards(exhibition_id) WHERE exhibition_id IS NOT NULL;


-- ============================================================
-- BLOCO H — VIEWS DE ALERTAS DE NASCIMENTOS (Dashboard)
-- Consolida FIV/TE + Coberturas Naturais
-- ============================================================

-- View mestre: TODOS os partos previstos confirmados (FIV + Cobertura Natural)
CREATE OR REPLACE VIEW v_all_expected_births AS

    -- Partos via FIV/TE
    SELECT
        dg.farm_id,
        'FIV_TE'                            AS origem,
        tr.id                               AS evento_id,
        dg.data_previsao_parto,
        dg.data_previsao_parto - CURRENT_DATE AS dias_restantes,
        COALESCE(d.nome,  asp.doadora_nome) AS doadora,
        COALESCE(t.nome,  asp.touro_nome)   AS touro,
        COALESCE(r.nome,  tr.receptora_brinco) AS receptora,
        r.brinco                            AS brinco_receptora,
        dg.leilao_destino,
        dg.id                               AS dg_id,
        NULL::UUID                          AS cobertura_id
    FROM pregnancy_diagnoses dg
    JOIN transfers tr    ON tr.id  = dg.transfer_id
    JOIN embryos e       ON e.id   = tr.embryo_id
    JOIN aspirations asp ON asp.id = e.aspiration_id
    LEFT JOIN animals d  ON d.id  = asp.doadora_id
    LEFT JOIN animals t  ON t.id  = asp.touro_id
    LEFT JOIN animals r  ON r.id  = tr.receptora_id
    WHERE dg.resultado           = 'POSITIVO'
      AND dg.data_previsao_parto IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM births b WHERE b.dg_id = dg.id
      )

UNION ALL

    -- Partos via Cobertura Natural / IA
    SELECT
        nc.farm_id,
        nc.tipo                             AS origem,
        nc.id                               AS evento_id,
        nc.data_previsao_parto,
        nc.data_previsao_parto - CURRENT_DATE AS dias_restantes,
        COALESCE(f.nome, nc.femea_nome)     AS doadora,
        COALESCE(t.nome, nc.touro_nome)     AS touro,
        COALESCE(f.nome, nc.femea_nome)     AS receptora,   -- a própria fêmea
        f.brinco                            AS brinco_receptora,
        NULL                                AS leilao_destino,
        NULL::UUID                          AS dg_id,
        nc.id                               AS cobertura_id
    FROM natural_coverings nc
    LEFT JOIN animals f  ON f.id = nc.femea_id
    LEFT JOIN animals t  ON t.id = nc.touro_id
    WHERE nc.resultado_dg           = 'POSITIVO'
      AND nc.data_previsao_parto    IS NOT NULL
      AND nc.data_parto_real        IS NULL;

COMMENT ON VIEW v_all_expected_births IS
    'União de todos os partos esperados (FIV/TE + Cobertura Natural) ainda não confirmados.';


-- Alerta de nascimentos — Próximos 7 dias (Esta semana)
CREATE OR REPLACE VIEW v_births_this_week AS
SELECT * FROM v_all_expected_births
WHERE dias_restantes BETWEEN 0 AND 7
ORDER BY data_previsao_parto;

COMMENT ON VIEW v_births_this_week IS 'Partos previstos nos próximos 7 dias — alerta de urgência no dashboard.';

-- Alerta de nascimentos — Próximos 30 dias (Este mês)
CREATE OR REPLACE VIEW v_births_this_month AS
SELECT * FROM v_all_expected_births
WHERE dias_restantes BETWEEN 0 AND 30
ORDER BY data_previsao_parto;

COMMENT ON VIEW v_births_this_month IS 'Partos previstos nos próximos 30 dias — alerta mensal no dashboard.';

-- Alerta de nascimentos — Próximos 90 dias (Próximo trimestre)
CREATE OR REPLACE VIEW v_births_next_quarter AS
SELECT * FROM v_all_expected_births
WHERE dias_restantes BETWEEN 0 AND 90
ORDER BY data_previsao_parto;

COMMENT ON VIEW v_births_next_quarter IS 'Partos previstos nos próximos 90 dias — visão trimestral.';

-- Partos ATRASADOS: data prevista já passou e ainda não nasceu
CREATE OR REPLACE VIEW v_overdue_births AS
SELECT * FROM v_all_expected_births
WHERE dias_restantes < 0
ORDER BY dias_restantes;   -- Mais atrasados primeiro

COMMENT ON VIEW v_overdue_births IS 'Partos com data prevista ultrapassada e sem confirmação de nascimento — requer atenção imediata.';


-- ============================================================
-- BLOCO I — VIEW: Peso mais recente de cada animal
-- ============================================================

CREATE OR REPLACE VIEW v_latest_weight AS
SELECT DISTINCT ON (animal_id)
    wr.animal_id,
    a.nome          AS animal_nome,
    a.brinco,
    a.tipo          AS animal_tipo,
    wr.data         AS data_pesagem,
    wr.peso_kg,
    CURRENT_DATE - wr.data AS dias_desde_pesagem,
    a.farm_id
FROM weight_records wr
JOIN animals a ON a.id = wr.animal_id
ORDER BY animal_id, wr.data DESC;

COMMENT ON VIEW v_latest_weight IS
    'Peso mais recente de cada animal. Usar para acompanhamento e comparação com peso mínimo de exposição.';


-- ============================================================
-- BLOCO J — VIEW: Animais aptos para próximas exposições
-- (em faixa etária válida para algum campeonato)
-- ============================================================

CREATE OR REPLACE VIEW v_animals_show_eligible AS
SELECT
    a.farm_id,
    a.id            AS animal_id,
    a.nome,
    a.rgn,
    a.sexo,
    a.nascimento,
    a.tipo,
    ROUND(
        (EXTRACT(YEAR FROM AGE(CURRENT_DATE, a.nascimento)) * 12 +
         EXTRACT(MONTH FROM AGE(CURRENT_DATE, a.nascimento)) +
         EXTRACT(DAY FROM AGE(CURRENT_DATE, a.nascimento)) / 30.0
        )::NUMERIC, 1
    )               AS idade_atual_meses,
    cg.nome         AS campeonato_atual,
    cg.grupo_nelore,
    lw.peso_kg      AS ultimo_peso_kg,
    lw.data_pesagem AS data_ultimo_peso
FROM animals a
JOIN championship_groups cg ON
    cg.sexo = a.sexo
    AND (
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, a.nascimento)) * 12 +
        EXTRACT(MONTH FROM AGE(CURRENT_DATE, a.nascimento)) +
        EXTRACT(DAY FROM AGE(CURRENT_DATE, a.nascimento)) / 30.0
    ) >= cg.idade_min_meses
    AND (
        EXTRACT(YEAR FROM AGE(CURRENT_DATE, a.nascimento)) * 12 +
        EXTRACT(MONTH FROM AGE(CURRENT_DATE, a.nascimento)) +
        EXTRACT(DAY FROM AGE(CURRENT_DATE, a.nascimento)) / 30.0
    ) < cg.idade_max_meses
LEFT JOIN v_latest_weight lw ON lw.animal_id = a.id
WHERE a.nascimento IS NOT NULL
  AND a.tipo IN ('NASCIDO', 'DOADORA', 'TOURO')
  AND a.sexo IS NOT NULL
ORDER BY a.farm_id, cg.grupo_nelore, cg.sexo, cg.nome, a.nascimento;

COMMENT ON VIEW v_animals_show_eligible IS
    'Lista todos os animais cadastrados que atualmente se enquadram em algum grupo de campeonato ACNB.';


-- ============================================================
-- BLOCO K — VIEW: Histórico de premiações por animal
-- ============================================================

CREATE OR REPLACE VIEW v_animal_awards_history AS
SELECT
    aw.farm_id,
    a.nome          AS animal,
    a.rgn,
    a.sexo,
    ex.nome         AS exposicao,
    ex.data_base,
    ex.tipo         AS tipo_exposicao,
    aw.grupo_nelore,
    cg.nome         AS campeonato,
    sc.nome_categoria AS categoria,
    aw.tipo_premio,
    aw.descricao_premio,
    aw.pontos_obtidos,
    aw.jurado,
    aw.foto_url
FROM awards aw
JOIN animals a          ON a.id  = aw.animal_id
LEFT JOIN exhibitions ex ON ex.id = aw.exhibition_id
LEFT JOIN championship_groups cg ON cg.id = aw.championship_group_id
LEFT JOIN show_categories sc ON sc.id = aw.show_category_id
ORDER BY ex.data_base DESC NULLS LAST, a.nome;

COMMENT ON VIEW v_animal_awards_history IS
    'Histórico completo de premiações por animal, com detalhes da exposição e categoria.';


-- ============================================================
-- FIM DO SCRIPT v2
-- ============================================================
-- Tabelas criadas neste arquivo:
--   natural_coverings, exhibitions, championship_groups (global),
--   show_categories (global), animal_show_entries, awards
--
-- Funções criadas:
--   get_animal_show_category(animal_id, exhibition_id)
--
-- Views criadas:
--   v_all_expected_births, v_births_this_week, v_births_this_month,
--   v_births_next_quarter, v_overdue_births,
--   v_latest_weight, v_animals_show_eligible, v_animal_awards_history
--
-- Para testar a função de categoria:
--   SELECT * FROM get_animal_show_category(
--       '<uuid_do_animal>',
--       '<uuid_da_exposicao>'
--   );
-- ============================================================
