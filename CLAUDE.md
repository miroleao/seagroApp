# SE Agropecuária Nelore de Elite — Guia do Projeto

> Leia este arquivo inteiro antes de qualquer tarefa. Ele define stack, convenções, regras de negócio e o que NÃO fazer.

---

## 1. Visão Geral

Aplicativo web de gestão de fazenda de gado **Nelore de Elite**. O dono é SE Agropecuaria, fazenda de gado de elite no Piaui. O sistema gerencia doadoras, touros, reprodução (OPU/FIV), rebanho de receptoras, exposições/pista e financeiro.

**Visão futura:** tornar-se SaaS multi-tenant para venda a outras fazendas de elite.

---

## 2. Stack

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 15 (App Router) |
| Linguagem | TypeScript (strict) |
| Banco de dados | Supabase (PostgreSQL) |
| Autenticação | Supabase Auth |
| Estilo | Tailwind CSS |
| Deploy | Vercel |

**Versões mínimas:** Node 20+, Next.js 15, React 19.

---

## 3. Arquivos de Referência

Antes de implementar qualquer coisa, leia:

- `SE_Agro_Elite_Documentacao.docx` — schema completo do banco, rotas, fluxos de dados, componentes
- `SE_Agro_Fluxograma_Navegacao.mermaid` — mapa visual de toda a navegação do app

---

## 4. Estrutura de Pastas

```
seagro/
├── src/
│   ├── app/                    # App Router (pages + API routes)
│   │   ├── dashboard/
│   │   ├── doadoras/
│   │   ├── machos/
│   │   ├── rebanho/
│   │   ├── reproducao/
│   │   ├── aspiracoes/
│   │   ├── embrioes/
│   │   ├── pista/
│   │   ├── financeiro/
│   │   ├── elitia/
│   │   └── api/                # Route Handlers para operações complexas
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts       # createBrowserClient
│   │   │   └── server.ts       # createClient (server-side)
│   │   └── utils.ts            # FARM_ID, helpers de data
│   ├── types/
│   │   └── index.ts            # Tipo Animal e outros — SEMPRE atualizar ao adicionar colunas DB
│   └── components/             # Componentes reutilizáveis
├── .env.local                  # Variáveis de ambiente (não commitar)
└── CLAUDE.md                   # Este arquivo
```

---

## 5. Multi-Tenancy

O projeto usa isolamento por `farm_id`:

```typescript
// lib/utils.ts
export const FARM_ID = process.env.NEXT_PUBLIC_FARM_ID!;
```

**Regra:** Toda query ao Supabase deve incluir `.eq("farm_id", FARM_ID)`. Sem exceção.

---

## 6. Padrões de Código — OBRIGATÓRIOS

### 6.1 Server vs Client Components

- **Preferência: Server Components**. Evitar `"use client"` sempre que possível.
- Formulários usam **Server Actions** (`"use server"`), nunca `onSubmit` com fetch client-side.
- Client Components (`"use client"`) apenas quando necessário: tabelas com inline edit, dropdowns interativos, chat.

```typescript
// ✅ CORRETO — Page busca dados no servidor e passa para o componente
export default async function Page() {
  const supabase = await createClient();
  const { data } = await supabase.from("animals").select("*").eq("farm_id", FARM_ID);
  return <MinhaTabela data={data} />;
}

// ❌ ERRADO — nunca usar useEffect + fetch no client para carregar dados iniciais
```

### 6.2 Server Actions

```typescript
"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function criarAnimal(formData: FormData) {
  const supabase = await createClient();
  // ... lógica
  revalidatePath("/doadoras");
  redirect("/doadoras");
}
```

### 6.3 API Route Handlers

Use `src/app/api/` apenas para operações que exigem múltiplos passos assíncronos encadeados (ex: salvar embrião → criar receptora → criar transfer → criar DG). Para CRUD simples, use Server Actions.

### 6.4 Tipos TypeScript

Ao adicionar uma coluna no banco, SEMPRE atualizar `src/types/index.ts`. O tipo `Animal` é central.

---

## 7. Banco de Dados — Tabelas Principais

> Schema completo em `SE_Agro_Elite_Documentacao.docx`, Seção 3.

### Tabelas core:

| Tabela | Descrição |
|---|---|
| `animals` | Todos os animais: DOADORA, TOURO, RECEPTORA. Campo `tipo` distingue. |
| `opu_sessions` | Sessões OPU (aspiração de óvulos) |
| `aspirations` | Aspirações individuais por doadora em cada sessão OPU |
| `embryos` | Embriões produzidos em FIV |
| `transfers` | Transferência de embrião para receptora |
| `pregnancy_diagnoses` | Diagnóstico de gestação (DG) com resultado e data |
| `weight_records` | Pesagens de animais com cálculo de ponderal (g/dia) |
| `awards` | Premiações em exposições |
| `animal_partners` | Sócios de um animal (até 3, com percentual e parcela) |
| `partners` | Cadastro de sócios |
| `exhibitions` | Exposições/eventos de pista |
| `transactions` | Transações financeiras (compras, vendas, parcelas) |

### Enums importantes (PostgreSQL ou string em TypeScript):

```
-- animals.tipo
DOADORA | TOURO | RECEPTORA

-- animals.status_rebanho
ATIVA | PRENHA_EMBRIAO | PRENHA_NATURAL | FALHADA | VENDIDA | MORTA

-- embryos.sexagem
NAO_SEXADO | MACHO | FEMEA

-- embryos.status
DISPONIVEL | IMPLANTADO | DESCARTADO

-- pregnancy_diagnoses.resultado
POSITIVO | NEGATIVO
```

---

## 8. Regras de Negócio — NÃO ALTERAR SEM CONFIRMAR

### Idades de animais
Exibir sempre em **meses acumulados**: `${meses}m` (ex: "15m"). Nunca "1a 3m".

### Cálculo de previsão de parto
`data_fiv + 293 dias` → data de previsão de parto.

### Peso ponderal
`(peso_atual - peso_nascimento) / dias_desde_nascimento * 1000` = g/dia.
Classificação Nelore por faixa etária:
- Excelente: ≥ 800 g/dia
- Bom: 600–799 g/dia
- Abaixo: < 600 g/dia

### Status de receptora após DG
Se DG = POSITIVO → `status_rebanho = "PRENHA_EMBRIAO"`.

### Para Pista (elegibilidade)
Animal elegível para exposição: precisa ter RGD + status APTO + CE mínima válida (touros).

### Labels na UI (não mostrar enums do banco)
| Banco | UI |
|---|---|
| `POSITIVO` | `P+` |
| `NEGATIVO` | `Vazia` |
| `NAO_SEXADO` | `Não Sexado` |
| `DOADORA` | `Doadora` |
| `TOURO` | `Touro` |
| `RECEPTORA` | `Receptora` |

---

## 9. Migrações SQL

Ao adicionar colunas ou tabelas:
1. Criar arquivo `.sql` na raiz do projeto (ex: `add_campo_xyz.sql`)
2. Avisar o usuário para rodar no **Supabase SQL Editor**
3. Atualizar `src/types/index.ts`
4. Atualizar Server Actions/queries relevantes

O usuário roda migrações manualmente — não há CLI de migração automatizada no projeto.

---

## 10. Variáveis de Ambiente (.env.local)

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_FARM_ID=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...          # Para o módulo ElitIA (chat IA)
```

Nunca commitar `.env.local`.

---

## 11. Módulos do App

Ver fluxograma completo em `SE_Agro_Fluxograma_Navegacao.mermaid`.

| Rota | Módulo | Descrição |
|---|---|---|
| `/dashboard` | Dashboard | Stats, nascimentos, alertas de peso, ranking |
| `/doadoras` | Doadoras | Listagem, filtros, sócios, prêmios |
| `/doadoras/[id]` | Ficha Doadora | Aspirações, genealogia 5 gerações, prêmios, venda |
| `/doadoras/novo` | Nova Doadora | Cadastro com genealogia e sócios |
| `/machos` | Touros | Listagem com andrológico, CE, RGD, filtros |
| `/machos/[id]` | Ficha Touro | Exame andrológico, CE, prêmios, pesagens, Para Pista |
| `/machos/novo` | Novo Touro | Cadastro com dados reprodutivos, CE, sócios |
| `/rebanho` | Rebanho | Receptoras: prenhes ativas, classificação, peso, status |
| `/rebanho/[id]` | Ficha Animal | Pesagem, status, nascimento |
| `/reproducao` | Reprodução | Sessões OPU-FIV, embriões inline edit, prenhezes |
| `/reproducao/opu/nova` | Nova Sessão OPU | Múltiplas doadoras, lab, touro |
| `/reproducao/prenhezes` | Lista Prenhezes | Brinco ABCZ, parto, desfecho |
| `/reproducao/prenhezes/[id]` | Ficha Prenhez | Doadora, touro, receptora, compra, desfecho |
| `/aspiracoes` | Aspirações | Estoque por doadora, totais OPU |
| `/embrioes` | Embriões | Estoque com filtros: CDC-FIV, ADT-TE, DNA, sexagem |
| `/pista` | Exposições | Grupos ABCZ, prêmios, animais selecionados |
| `/financeiro` | Financeiro | Transações, parcelas, leilões, compras/vendas |
| `/elitia` | ElitIA | Chat IA com contexto do banco de dados |

---

## 12. Fluxos Críticos

### OPU → Embrião
`opu_sessions` → `aspirations` (por doadora) → `embryos` (produzidos em FIV)

### Embrião → Prenhez
`embryos` → `transfers` (receptora recebe embrião) → `pregnancy_diagnoses` (DG)

### Nascimento
`pregnancy_diagnoses.resultado = POSITIVO` → registro de nascimento → cria novo `Animal` (DOADORA ou TOURO)

### Venda
`Animal` → `transactions` (tipo VENDA, com parcelas se necessário)

---

## 13. O que NÃO Fazer

- ❌ Nunca usar `useEffect` + `fetch` para carregar dados iniciais — use Server Components
- ❌ Nunca omitir `.eq("farm_id", FARM_ID)` em queries
- ❌ Nunca mostrar enums do banco diretamente na UI — sempre mapear para labels legíveis
- ❌ Nunca commitar `.env.local`
- ❌ Nunca criar migrações automáticas — gerar arquivo SQL e avisar o usuário
- ❌ Nunca exibir idade em anos+meses — sempre em meses totais (`${n}m`)
- ❌ Nunca quebrar o multi-tenant — toda nova tabela precisa de coluna `farm_id`

---

## 14. Convenções de Nomenclatura

- **Banco:** snake_case (ex: `status_rebanho`, `data_nascimento`)
- **TypeScript:** camelCase (ex: `statusRebanho`, `dataNascimento`)
- **Componentes:** PascalCase (ex: `TabelaEmbrioes.tsx`, `FichaDoadoras.tsx`)
- **Server Actions:** verbos no infinitivo (ex: `criarAnimal`, `salvarPesagem`)
- **API Routes:** kebab-case na pasta (ex: `/api/salvar-embriao/route.ts`)

---

## 15. Ordem de Implementação Recomendada (novo projeto)

1. Setup: Next.js 15 + Supabase + Tailwind + env vars
2. Schema SQL: rodar todas as migrations (ver Documentação Seção 3)
3. `src/lib/supabase/` + `src/lib/utils.ts` + `src/types/index.ts`
4. Layout base + navegação lateral
5. **Módulo Animais:** `/doadoras` → `/machos` → `/rebanho`
6. **Módulo Reprodução:** `/reproducao` (OPU + embriões) → prenhezes
7. **Módulo Gestão:** `/pista` → `/financeiro`
8. **Dashboard:** montar após ter dados reais
9. **ElitIA:** último — depende de todos os outros módulos

---

*Gerado em abril/2026. Projeto em construção iterativa com Mateus (Chefe), dono da SE Agropecuária Nelore de Elite.*
