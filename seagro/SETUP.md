# SE Agro Elite — Setup do Projeto

## Pré-requisitos
- Node.js 18+ (https://nodejs.org)
- Conta no Supabase (já configurada com os scripts SQL)
- Conta na Vercel (para deploy — opcional)

---

## 1. Instalar dependências

Abra o terminal na pasta do projeto e execute:

```bash
npm install
```

---

## 2. Configurar variáveis de ambiente

Copie o arquivo de exemplo e preencha com seus dados do Supabase:

```bash
cp .env.local.example .env.local
```

Depois abra `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_anon_key
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
NEXT_PUBLIC_FARM_ID=aaaaaaaa-0000-0000-0000-000000000001
```

**Onde encontrar essas chaves no Supabase:**
1. Acesse https://supabase.com/dashboard
2. Clique no seu projeto
3. Vá em **Project Settings → API**
4. Copie a **URL do projeto** e a chave **anon/public**

---

## 3. Rodar localmente

```bash
npm run dev
```

Acesse http://localhost:3000 no navegador.

---

## 4. Deploy na Vercel

### Opção A — Via interface web (mais fácil)
1. Crie uma conta em https://vercel.com
2. Clique em **"Add New Project"**
3. Importe o repositório do GitHub (faça push do projeto primeiro)
4. Na tela de configuração, vá em **"Environment Variables"** e adicione as mesmas variáveis do `.env.local`
5. Clique em **Deploy**

### Opção B — Via CLI
```bash
npm install -g vercel
vercel
# Siga as instruções no terminal
```

---

## 5. Subir para o GitHub (antes do deploy)

```bash
git init
git add .
git commit -m "feat: setup inicial SE Agro Elite"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/seagro.git
git push -u origin main
```

---

## Estrutura do Projeto

```
src/
├── app/                  # Páginas (Next.js App Router)
│   ├── dashboard/        # Tela inicial com alertas e KPIs
│   ├── doadoras/         # Gestão de doadoras
│   ├── rebanho/          # Rebanho de receptoras
│   ├── aspiracoes/       # Sessões OPU/FIV
│   ├── embrioes/         # Estoque de embriões
│   ├── pista/            # Exposições e premiações
│   └── financeiro/       # Compras, vendas e parcelas
├── components/
│   └── layout/           # Sidebar e layout geral
├── lib/
│   ├── supabase/         # Clientes do Supabase (client/server)
│   └── utils.ts          # Funções utilitárias
└── types/
    └── index.ts          # Tipos TypeScript do banco de dados
```
