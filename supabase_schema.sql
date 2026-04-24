-- ============================================================
--  SE AGROPECUÁRIA NELORE DE ELITE
--  Script SQL — Criação do Schema no Supabase (PostgreSQL)
--  Versão 1.0 | Março 2026
--
--  INSTRUÇÕES:
--  1. Acesse seu projeto no Supabase (supabase.com)
--  2. Vá em SQL Editor > New Query
--  3. Cole este script inteiro e clique em "Run"
--  4. Após rodar, execute o bloco de RLS separadamente
-- ============================================================


-- ============================================================
-- EXTENSÕES NECESSÁRIAS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- ============================================================
-- BLOCO 1 — FAZENDAS (Multi-tenant: cada fazenda é um cliente)
-- ============================================================

CREATE TABLE farms (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome        TEXT NOT NULL,
    cnpj        TEXT,
    telefone    TEXT,
    email       TEXT,
    cidade      TEXT,
    estado      TEXT,
    plano       TEXT NOT NULL DEFAULT 'basic'
                    CHECK (plano IN ('basic', 'professional', 'elite')),
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE farms IS 'Cadastro de fazendas clientes. Cada linha é um tenant isolado.';
COMMENT ON COLUMN farms.plano IS 'Plano de assinatura SaaS: basic | professional | elite';


-- ============================================================
-- BLOCO 2 — USUÁRIOS E PERFIS
-- ============================================================

-- Perfis de usuário vinculados ao auth.users do Supabase
CREATE TABLE profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    farm_id     UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    nome        TEXT NOT NULL,
    email       TEXT NOT NULL,
    papel       TEXT NOT NULL DEFAULT 'viewer'
                    CHECK (papel IN ('owner', 'manager', 'viewer')),
    ativo       BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN profiles.papel IS 'owner: acesso total | manager: edição | viewer: somente leitura';


-- ============================================================
-- BLOCO 3 — SÓCIOS (pessoas físicas/jurídicas com participação)
-- ============================================================

CREATE TABLE partners (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id     UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    nome        TEXT NOT NULL,
    cpf_cnpj    TEXT,
    telefone    TEXT,
    email       TEXT,
    observacoes TEXT,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE partners IS 'Sócios/parceiros que possuem participação em animais da fazenda.';


-- ============================================================
-- BLOCO 4 — ANIMAIS (tabela central — doadoras, touros, receptoras, nascidos)
-- ============================================================

CREATE TABLE animals (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id             UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,

    -- Identificação
    nome                TEXT NOT NULL,
    rgn                 TEXT,                          -- Registro Genealógico Nacional (ABCZ)
    brinco              TEXT,                          -- Brinco de campo (receptoras)
    tipo                TEXT NOT NULL
                            CHECK (tipo IN (
                                'DOADORA', 'TOURO', 'RECEPTORA', 'NASCIDO', 'DESCARTE'
                            )),
    sexo                TEXT CHECK (sexo IN ('F', 'M')),
    nascimento          DATE,

    -- Genealogia (referências a outros animais ou texto livre)
    pai_id              UUID REFERENCES animals(id),   -- FK para touro cadastrado
    pai_nome            TEXT,                          -- Nome livre (quando pai não está cadastrado)
    mae_id              UUID REFERENCES animals(id),   -- FK para doadora cadastrada
    mae_nome            TEXT,                          -- Nome livre
    avo_materno         TEXT,                          -- Avô materno (texto livre)
    avo_materna         TEXT,                          -- Avó materna (texto livre)
    bisavo              TEXT,                          -- Bisavó (texto livre)

    -- Status e localização
    status_reprodutivo  TEXT CHECK (status_reprodutivo IN (
                            'COLETANDO', 'INSEMINADA', 'GESTANTE',
                            'VAZIA', 'SECA', 'DESCARTADA', 'VENDIDA'
                        )),
    localizacao         TEXT,                          -- Fazenda/lote onde está o animal
    situacao            TEXT,                          -- Campo livre para situação atual

    -- Financeiro (específico de doadoras)
    valor_parcela       NUMERIC(12,2),
    percentual_proprio  NUMERIC(5,4),                  -- % da própria fazenda (ex: 0.25 = 25%)

    -- Mídia e notas
    foto_url            TEXT,
    observacoes         TEXT,
    dna_coletado        BOOLEAN DEFAULT FALSE,

    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE animals IS 'Tabela central de todos os animais: doadoras, touros, receptoras e nascidos.';
COMMENT ON COLUMN animals.pai_id IS 'Referência ao pai cadastrado como TOURO. Use pai_nome quando não cadastrado.';
COMMENT ON COLUMN animals.percentual_proprio IS 'Percentual de participação da própria fazenda no animal (0 a 1).';


-- ============================================================
-- BLOCO 5 — SÓCIOS POR ANIMAL (participação %)
-- ============================================================

CREATE TABLE animal_partners (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    animal_id       UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
    partner_id      UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    percentual      NUMERIC(5,4) NOT NULL               -- Ex: 0.25 = 25%
                        CHECK (percentual > 0 AND percentual <= 1),
    valor_parcela   NUMERIC(12,2),                      -- Parcela mensal deste sócio (R$)
    observacoes     TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (animal_id, partner_id)
);

COMMENT ON TABLE animal_partners IS 'Participação societária por animal. A soma dos percentuais de todos os sócios + percentual_proprio do animal deve ser <= 1.';


-- ============================================================
-- BLOCO 6 — PESAGENS (histórico de peso por animal)
-- ============================================================

CREATE TABLE weight_records (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    animal_id   UUID NOT NULL REFERENCES animals(id) ON DELETE CASCADE,
    farm_id     UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    data        DATE NOT NULL,
    peso_kg     NUMERIC(7,2) NOT NULL,
    observacoes TEXT,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE weight_records IS 'Histórico de pesagens. Especialmente usado para receptoras.';


-- ============================================================
-- BLOCO 7 — SESSÕES DE ASPIRAÇÃO (OPU/FIV)
-- ============================================================

CREATE TABLE opu_sessions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    data            DATE NOT NULL,
    tipo            TEXT NOT NULL
                        CHECK (tipo IN ('REALIZADA', 'COMPRADA')),
                    -- REALIZADA: sessão feita na fazenda
                    -- COMPRADA:  embriões adquiridos de terceiros
    laboratorio     TEXT,                              -- Nome do laboratório ou equipe
    responsavel     TEXT,                              -- Veterinário responsável
    local           TEXT,                              -- Local da realização
    observacoes     TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE opu_sessions IS 'Sessão de aspiração OPU/FIV. Agrupa múltiplas doadoras coletadas no mesmo evento.';


-- ============================================================
-- BLOCO 8 — ASPIRAÇÕES (uma por doadora dentro da sessão)
-- ============================================================

CREATE TABLE aspirations (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id              UUID NOT NULL REFERENCES opu_sessions(id) ON DELETE CASCADE,
    farm_id                 UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    doadora_id              UUID REFERENCES animals(id),   -- Doadora cadastrada
    doadora_nome            TEXT,                          -- Nome livre (se não cadastrada)
    doadora_rgn             TEXT,                          -- RGN livre
    touro_id                UUID REFERENCES animals(id),   -- Touro cadastrado
    touro_nome              TEXT,                          -- Nome livre
    oocitos_viaveis         INTEGER DEFAULT 0,
    embryos_congelados      INTEGER DEFAULT 0,

    -- Custos
    custo_veterinario       NUMERIC(12,2) DEFAULT 0,
    custo_laboratorio       NUMERIC(12,2) DEFAULT 0,
    custo_receptoras        NUMERIC(12,2) DEFAULT 0,
    custo_total             NUMERIC(12,2)
                                GENERATED ALWAYS AS (
                                    COALESCE(custo_veterinario,0) +
                                    COALESCE(custo_laboratorio,0) +
                                    COALESCE(custo_receptoras,0)
                                ) STORED,
    -- custo_por_embryo é calculado na aplicação (evita divisão por zero no banco)

    observacoes             TEXT,
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE aspirations IS 'Uma aspiração por doadora dentro de uma sessão OPU. custo_total é calculado automaticamente.';
COMMENT ON COLUMN aspirations.custo_total IS 'Soma automática de veterinário + laboratório + receptoras (coluna gerada).';


-- ============================================================
-- BLOCO 9 — EMBRIÕES (estoque individual)
-- ============================================================

CREATE TABLE embryos (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aspiration_id   UUID NOT NULL REFERENCES aspirations(id) ON DELETE CASCADE,
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    numero_cdc_fiv  TEXT,                              -- Nº do laboratório (CDC-FIV)
    numero_adt_te   TEXT,                              -- Nº da associação (ADT-TE)
    sexagem         TEXT DEFAULT 'NAO_SEXADO'
                        CHECK (sexagem IN ('FEMEA', 'MACHO', 'NAO_SEXADO')),
    status          TEXT NOT NULL DEFAULT 'DISPONIVEL'
                        CHECK (status IN ('DISPONIVEL', 'IMPLANTADO', 'DESCARTADO')),
    observacoes     TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE embryos IS 'Estoque de embriões. Status muda de DISPONIVEL para IMPLANTADO ao criar uma transferência.';


-- ============================================================
-- BLOCO 10 — TRANSFERÊNCIAS DE EMBRIÃO (TE)
-- ============================================================

CREATE TABLE transfers (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    embryo_id       UUID NOT NULL REFERENCES embryos(id),
    receptora_id    UUID REFERENCES animals(id),       -- Receptora cadastrada
    receptora_brinco TEXT,                             -- Brinco livre (se não cadastrada)
    receptora_rgn   TEXT,                              -- RGN da receptora (ABCZ)
    sessao_nome     TEXT,                              -- Ex: "T.E. 4", "T.E. JANEIRO/26"
    data_te         DATE NOT NULL,
    responsavel     TEXT,
    protocolo       TEXT CHECK (protocolo IN ('CLOE', 'CLOD', 'SEM_CL', 'NAO_INFORMADO')),
    peso_receptora  NUMERIC(7,2),                      -- Peso no dia do TE (kg)
    observacoes     TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE transfers IS 'Registro de implante de embrião em receptora. Ao inserir, o trigger atualiza embryos.status para IMPLANTADO.';


-- ============================================================
-- BLOCO 11 — DIAGNÓSTICO DE GESTAÇÃO (DG)
-- ============================================================

CREATE TABLE pregnancy_diagnoses (
    id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_id             UUID NOT NULL REFERENCES transfers(id) ON DELETE CASCADE,
    farm_id                 UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    data_dg                 DATE NOT NULL,
    resultado               TEXT NOT NULL
                                CHECK (resultado IN (
                                    'POSITIVO', 'VAZIO', 'ABSORVEU', 'ABORTOU'
                                )),
    data_previsao_parto     DATE,                      -- Informada ou calculada: data_te + 285 dias
    leilao_destino          TEXT,                      -- Nome do leilão de destino do bezerro
    vendedores              TEXT,                      -- Nomes dos vendedores (texto livre)
    observacoes             TEXT,
    criado_em               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE pregnancy_diagnoses IS 'Diagnóstico de gestação (DG) vinculado a uma transferência. POSITIVO = prenhez confirmada.';


-- ============================================================
-- BLOCO 12 — NASCIMENTOS
-- ============================================================

CREATE TABLE births (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dg_id           UUID NOT NULL REFERENCES pregnancy_diagnoses(id) ON DELETE CASCADE,
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    data_parto      DATE NOT NULL,
    animal_id       UUID REFERENCES animals(id),       -- Bezerro criado no cadastro de animais
    sexo_nascido    TEXT CHECK (sexo_nascido IN ('F', 'M')),
    nome_nascido    TEXT,
    rgn_nascido     TEXT,
    dna_coletado    BOOLEAN DEFAULT FALSE,
    peso_nascimento NUMERIC(6,2),                      -- Peso ao nascer (kg)
    observacoes     TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE births IS 'Registro de nascimento. animal_id aponta para o bezerro criado automaticamente na tabela animals.';


-- ============================================================
-- BLOCO 13 — LEILÕES
-- ============================================================

CREATE TABLE auctions (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id     UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    nome        TEXT NOT NULL,
    data        DATE,
    local       TEXT,
    organizador TEXT,
    observacoes TEXT,
    criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE auctions IS 'Leilões onde a fazenda participou como comprador e/ou vendedor.';


-- ============================================================
-- BLOCO 14 — TRANSAÇÕES (compras e vendas)
-- ============================================================

CREATE TABLE transactions (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farm_id         UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL CHECK (tipo IN ('COMPRA', 'VENDA')),
    animal_id       UUID REFERENCES animals(id),
    animal_nome     TEXT,                              -- Nome livre (se animal não cadastrado)
    auction_id      UUID REFERENCES auctions(id),
    data            DATE,
    valor_total     NUMERIC(12,2) NOT NULL,
    n_parcelas      INTEGER DEFAULT 1,
    contraparte     TEXT,                              -- Vendedor (se COMPRA) ou Comprador (se VENDA)
    observacoes     TEXT,
    criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE transactions IS 'Compras e vendas de animais em leilões. Gera parcelas na tabela installments.';


-- ============================================================
-- BLOCO 15 — PARCELAS
-- ============================================================

CREATE TABLE installments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_id      UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    farm_id             UUID NOT NULL REFERENCES farms(id) ON DELETE CASCADE,
    numero              INTEGER NOT NULL,               -- Nº da parcela (1, 2, 3...)
    vencimento          DATE NOT NULL,
    valor               NUMERIC(12,2) NOT NULL,
    status              TEXT NOT NULL DEFAULT 'PENDENTE'
                            CHECK (status IN ('PENDENTE', 'PAGO', 'ATRASADO')),
    data_pagamento      DATE,                          -- Preenchida quando status = PAGO
    observacoes         TEXT,
    criado_em           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (transaction_id, numero)
);

COMMENT ON TABLE installments IS 'Parcelas de compras e vendas. status ATRASADO é calculado pela aplicação (vencimento < hoje AND status = PENDENTE).';


-- ============================================================
-- BLOCO 16 — ÍNDICES (performance de consultas frequentes)
-- ============================================================

-- Animals
CREATE INDEX idx_animals_farm_id       ON animals(farm_id);
CREATE INDEX idx_animals_tipo          ON animals(farm_id, tipo);
CREATE INDEX idx_animals_rgn           ON animals(rgn) WHERE rgn IS NOT NULL;
CREATE INDEX idx_animals_brinco        ON animals(brinco) WHERE brinco IS NOT NULL;
CREATE INDEX idx_animals_pai_id        ON animals(pai_id) WHERE pai_id IS NOT NULL;
CREATE INDEX idx_animals_mae_id        ON animals(mae_id) WHERE mae_id IS NOT NULL;

-- Aspirations
CREATE INDEX idx_aspirations_farm_id   ON aspirations(farm_id);
CREATE INDEX idx_aspirations_session   ON aspirations(session_id);
CREATE INDEX idx_aspirations_doadora   ON aspirations(doadora_id) WHERE doadora_id IS NOT NULL;

-- Embryos
CREATE INDEX idx_embryos_farm_id       ON embryos(farm_id);
CREATE INDEX idx_embryos_status        ON embryos(farm_id, status);
CREATE INDEX idx_embryos_aspiration    ON embryos(aspiration_id);

-- Transfers
CREATE INDEX idx_transfers_farm_id     ON transfers(farm_id);
CREATE INDEX idx_transfers_embryo      ON transfers(embryo_id);
CREATE INDEX idx_transfers_receptora   ON transfers(receptora_id) WHERE receptora_id IS NOT NULL;
CREATE INDEX idx_transfers_data_te     ON transfers(data_te);

-- Pregnancy diagnoses
CREATE INDEX idx_dg_transfer           ON pregnancy_diagnoses(transfer_id);
CREATE INDEX idx_dg_farm               ON pregnancy_diagnoses(farm_id);
CREATE INDEX idx_dg_resultado          ON pregnancy_diagnoses(farm_id, resultado);
CREATE INDEX idx_dg_parto              ON pregnancy_diagnoses(data_previsao_parto)
                                           WHERE resultado = 'POSITIVO';

-- Installments
CREATE INDEX idx_installments_farm     ON installments(farm_id);
CREATE INDEX idx_installments_status   ON installments(farm_id, status);
CREATE INDEX idx_installments_venc     ON installments(vencimento)
                                           WHERE status = 'PENDENTE';

-- Weight records
CREATE INDEX idx_weight_animal         ON weight_records(animal_id, data DESC);


-- ============================================================
-- BLOCO 17 — TRIGGERS
-- ============================================================

-- Atualiza updated_at automaticamente
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.atualizado_em = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_animals_updated_at
    BEFORE UPDATE ON animals
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_embryos_updated_at
    BEFORE UPDATE ON embryos
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_installments_updated_at
    BEFORE UPDATE ON installments
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- Ao criar uma transferência, marca o embrião como IMPLANTADO
CREATE OR REPLACE FUNCTION mark_embryo_implanted()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE embryos
    SET status = 'IMPLANTADO', atualizado_em = NOW()
    WHERE id = NEW.embryo_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_transfer_marks_embryo
    AFTER INSERT ON transfers
    FOR EACH ROW EXECUTE FUNCTION mark_embryo_implanted();


-- Se DG for negativo (VAZIO/ABSORVEU/ABORTOU), reverte embrião para DISPONIVEL
-- (opcional — use apenas se quiser realocar o embrião)
-- CREATE OR REPLACE FUNCTION revert_embryo_on_negative_dg()
-- RETURNS TRIGGER AS $$ ... $$ LANGUAGE plpgsql;


-- ============================================================
-- BLOCO 18 — VIEWS ÚTEIS
-- ============================================================

-- Estoque de embriões disponíveis por Doadora × Touro
CREATE OR REPLACE VIEW v_embryo_stock AS
SELECT
    asp.farm_id,
    COALESCE(d.nome, asp.doadora_nome)  AS doadora,
    COALESCE(d.rgn,  asp.doadora_rgn)   AS doadora_rgn,
    COALESCE(t.nome, asp.touro_nome)    AS touro,
    e.sexagem,
    COUNT(*)                            AS qtd_disponivel
FROM embryos e
JOIN aspirations asp ON asp.id = e.aspiration_id
LEFT JOIN animals d   ON d.id  = asp.doadora_id
LEFT JOIN animals t   ON t.id  = asp.touro_id
WHERE e.status = 'DISPONIVEL'
GROUP BY asp.farm_id,
         COALESCE(d.nome, asp.doadora_nome),
         COALESCE(d.rgn,  asp.doadora_rgn),
         COALESCE(t.nome, asp.touro_nome),
         e.sexagem
ORDER BY COALESCE(d.nome, asp.doadora_nome), COALESCE(t.nome, asp.touro_nome);

COMMENT ON VIEW v_embryo_stock IS 'Estoque de embriões disponíveis agrupados por Doadora x Touro x Sexagem.';


-- Partos previstos nos próximos 90 dias
CREATE OR REPLACE VIEW v_upcoming_births AS
SELECT
    dg.farm_id,
    dg.data_previsao_parto,
    dg.data_previsao_parto - CURRENT_DATE  AS dias_restantes,
    COALESCE(d.nome, asp.doadora_nome)     AS doadora,
    COALESCE(t.nome, asp.touro_nome)       AS touro,
    COALESCE(r.nome, tr.receptora_brinco)  AS receptora,
    r.brinco                               AS brinco_receptora,
    dg.leilao_destino
FROM pregnancy_diagnoses dg
JOIN transfers tr   ON tr.id  = dg.transfer_id
JOIN embryos e      ON e.id   = tr.embryo_id
JOIN aspirations asp ON asp.id = e.aspiration_id
LEFT JOIN animals d  ON d.id  = asp.doadora_id
LEFT JOIN animals t  ON t.id  = asp.touro_id
LEFT JOIN animals r  ON r.id  = tr.receptora_id
WHERE dg.resultado = 'POSITIVO'
  AND dg.data_previsao_parto IS NOT NULL
  AND dg.data_previsao_parto >= CURRENT_DATE
  AND dg.data_previsao_parto <= CURRENT_DATE + INTERVAL '90 days'
  AND NOT EXISTS (
      SELECT 1 FROM births b WHERE b.dg_id = dg.id
  )
ORDER BY dg.data_previsao_parto;

COMMENT ON VIEW v_upcoming_births IS 'Partos previstos nos próximos 90 dias ainda não confirmados.';


-- Parcelas vencendo nos próximos 30 dias
CREATE OR REPLACE VIEW v_upcoming_installments AS
SELECT
    i.farm_id,
    i.vencimento,
    i.vencimento - CURRENT_DATE          AS dias_para_vencer,
    t.tipo,
    COALESCE(a.nome, t.animal_nome)      AS animal,
    au.nome                              AS leilao,
    t.contraparte,
    i.numero,
    t.n_parcelas,
    i.valor
FROM installments i
JOIN transactions t  ON t.id  = i.transaction_id
LEFT JOIN animals a  ON a.id  = t.animal_id
LEFT JOIN auctions au ON au.id = t.auction_id
WHERE i.status = 'PENDENTE'
  AND i.vencimento >= CURRENT_DATE
  AND i.vencimento <= CURRENT_DATE + INTERVAL '30 days'
ORDER BY i.vencimento;

COMMENT ON VIEW v_upcoming_installments IS 'Parcelas pendentes com vencimento nos próximos 30 dias.';


-- Taxa de aproveitamento por doadora (histórico completo)
CREATE OR REPLACE VIEW v_donor_efficiency AS
SELECT
    asp.farm_id,
    COALESCE(d.nome, asp.doadora_nome)   AS doadora,
    COALESCE(d.rgn,  asp.doadora_rgn)    AS doadora_rgn,
    s.data                               AS data_sessao,
    asp.oocitos_viaveis,
    asp.embryos_congelados,
    COUNT(tr.id)                         AS total_te,
    COUNT(dg.id) FILTER (WHERE dg.resultado = 'POSITIVO') AS total_positivo,
    ROUND(
        COUNT(dg.id) FILTER (WHERE dg.resultado = 'POSITIVO') * 100.0
        / NULLIF(asp.embryos_congelados, 0),
    1)                                   AS taxa_prenhez_pct,
    asp.custo_total,
    ROUND(
        asp.custo_total / NULLIF(
            COUNT(dg.id) FILTER (WHERE dg.resultado = 'POSITIVO'), 0
        ), 2
    )                                    AS custo_por_positivo
FROM aspirations asp
JOIN opu_sessions s   ON s.id  = asp.session_id
LEFT JOIN animals d   ON d.id  = asp.doadora_id
LEFT JOIN embryos e   ON e.aspiration_id = asp.id
LEFT JOIN transfers tr ON tr.embryo_id = e.id
LEFT JOIN pregnancy_diagnoses dg ON dg.transfer_id = tr.id
GROUP BY asp.farm_id,
         COALESCE(d.nome, asp.doadora_nome),
         COALESCE(d.rgn,  asp.doadora_rgn),
         s.data,
         asp.oocitos_viaveis, asp.embryos_congelados, asp.custo_total
ORDER BY COALESCE(d.nome, asp.doadora_nome), s.data;

COMMENT ON VIEW v_donor_efficiency IS 'Eficiência reprodutiva por doadora: oócitos, embriões, TEs, P+, taxa de prenhez e custo por P+.';


-- ============================================================
-- BLOCO 19 — ROW LEVEL SECURITY (RLS)
-- Garante que cada fazenda acessa APENAS seus próprios dados
-- ============================================================

-- Habilitar RLS em todas as tabelas de negócio
ALTER TABLE farms                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles                ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners                ENABLE ROW LEVEL SECURITY;
ALTER TABLE animals                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE animal_partners         ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_records          ENABLE ROW LEVEL SECURITY;
ALTER TABLE opu_sessions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE aspirations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE embryos                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE pregnancy_diagnoses     ENABLE ROW LEVEL SECURITY;
ALTER TABLE births                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE auctions                ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE installments            ENABLE ROW LEVEL SECURITY;

-- Função auxiliar: retorna o farm_id do usuário logado
CREATE OR REPLACE FUNCTION auth_farm_id()
RETURNS UUID AS $$
    SELECT farm_id FROM profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Políticas RLS — cada usuário vê e edita apenas dados da sua fazenda

-- farms: owner vê e edita sua própria fazenda
CREATE POLICY "farms_own" ON farms
    USING (id = auth_farm_id())
    WITH CHECK (id = auth_farm_id());

-- profiles: vê apenas perfis da sua fazenda
CREATE POLICY "profiles_own" ON profiles
    USING (farm_id = auth_farm_id())
    WITH CHECK (farm_id = auth_farm_id());

-- Macro para tabelas com farm_id direto
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOREACH tbl IN ARRAY ARRAY[
        'partners', 'animals', 'weight_records', 'opu_sessions',
        'aspirations', 'embryos', 'transfers', 'pregnancy_diagnoses',
        'births', 'auctions', 'transactions', 'installments'
    ] LOOP
        EXECUTE format(
            'CREATE POLICY "%s_own" ON %I
             USING (farm_id = auth_farm_id())
             WITH CHECK (farm_id = auth_farm_id())',
            tbl, tbl
        );
    END LOOP;
END;
$$;

-- Política extra para animal_partners (sem farm_id direto — usa animal_id)
DROP POLICY IF EXISTS "animal_partners_own" ON animal_partners;
CREATE POLICY "animal_partners_own" ON animal_partners
    USING (
        EXISTS (
            SELECT 1 FROM animals a
            WHERE a.id = animal_partners.animal_id
              AND a.farm_id = auth_farm_id()
        )
    );


-- ============================================================
-- BLOCO 20 — DADOS INICIAIS (seed para a SE Agropecuária)
-- ============================================================

-- Cria a fazenda SE Agropecuária Nelore de Elite
INSERT INTO farms (id, nome, cnpj, plano)
VALUES (
    'aaaaaaaa-0000-0000-0000-000000000001',
    'SE Agropecuária Nelore de Elite',
    NULL,
    'elite'
);

-- Sócios principais (baseado nos nomes identificados na planilha)
INSERT INTO partners (farm_id, nome) VALUES
    ('aaaaaaaa-0000-0000-0000-000000000001', 'Fernando Arruda'),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'Marcelo Napoleão'),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'Alan Resende'),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'Marcelo Noleto'),
    ('aaaaaaaa-0000-0000-0000-000000000001', 'Monte Verde');


-- ============================================================
-- FIM DO SCRIPT
-- ============================================================
-- Para verificar as tabelas criadas:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' ORDER BY table_name;
--
-- Para verificar as views:
--   SELECT viewname FROM pg_views WHERE schemaname = 'public';
--
-- Próximo passo: execute o script Python de migração da planilha
-- ============================================================
