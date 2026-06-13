# CrediControl — Sistema de Controle de Empréstimos

Sistema web para automatizar o controle de empréstimos pessoais com cálculo automático de juros compostos (30%/mês), multas por atraso e integração com WhatsApp.

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS v4
- **Backend**: Node.js + Express + TypeScript
- **ORM**: Prisma v5
- **Banco**: PostgreSQL (Supabase)
- **Testes**: Vitest (24/24 ✅)

---

## Desenvolvimento Local

### Pré-requisitos
- Node.js ≥ 20
- Conta no Supabase (ou PostgreSQL local)

### 1. Instalar dependências

```bash
# Na raiz do projeto
npm install --workspace=backend
npm install --workspace=frontend
```

### 2. Configurar variáveis de ambiente

```bash
cp backend/.env.example backend/.env
# Edite backend/.env com sua DATABASE_URL
```

### 3. Criar tabelas no banco

```bash
cd backend
npx prisma db push
npm run db:seed   # Popula com dados de teste
```

### 4. Rodar em desenvolvimento

```bash
# Terminal 1 — Backend (porta 3001)
npm run dev:backend

# Terminal 2 — Frontend (porta 5173)
npm run dev:frontend
```

Acesse: **http://localhost:5173**

---

## Deploy no Railway

### 1. Criar conta e projeto

1. Acesse [railway.app](https://railway.app) e crie uma conta
2. Crie um **New Project** → **Deploy from GitHub repo**
3. Conecte este repositório

### 2. Configurar variáveis de ambiente no Railway

No painel do Railway, vá em **Variables** e adicione:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | Connection string do Supabase (pooler, porta 6543 ou 5432) |
| `NODE_ENV` | `production` |

### 3. Deploy automático

O Railway detecta o `railway.toml` e executa automaticamente:
```
npm install && npm run build   # build FE + BE
node backend/dist/server.js    # start
```

O backend serve o frontend compilado — **um único serviço, zero CORS**.

---

## Regras de Negócio

| Regra | Implementação |
|---|---|
| Juros 30%/mês, capitalização diária | `M = P × (1.30)^(d/30)` em `loanCalculator.ts` |
| Multa R$ 10/dia a partir do D+31 | `calcPenalty()` |
| Amortização: Multa → Juros → Principal | `applyAmortization()` |
| Rollover: só reseta `lastRenewalDate` | `validateRollover()` |
| Todos os valores em centavos (inteiros) | RNF04 — sem erros de ponto flutuante |

---

## Rodar Testes

```bash
cd backend
npm run test   # 24 testes unitários do motor financeiro
```

---

## Estrutura do Projeto

```
credicontrol/
├── backend/
│   ├── prisma/schema.prisma     # Modelos do banco
│   ├── src/
│   │   ├── lib/
│   │   │   ├── loanCalculator.ts      # Motor de cálculo (funções puras)
│   │   │   ├── loanCalculator.test.ts # 24 testes unitários
│   │   │   └── prisma.ts              # Singleton do Prisma Client
│   │   ├── routes/
│   │   │   ├── debtors.routes.ts  # RF01: CRUD devedores
│   │   │   ├── loans.routes.ts    # RF02-04: Empréstimos, pagamentos, rollover
│   │   │   └── dashboard.routes.ts # RF05: Totais financeiros
│   │   ├── seed.ts                # Dados de teste
│   │   └── server.ts              # Entry point Express
│   └── .env.example
├── frontend/
│   └── src/
│       ├── pages/
│       │   ├── DashboardPage.tsx   # Visão geral + lista empréstimos
│       │   ├── DebtorsPage.tsx     # CRUD de devedores + novo empréstimo
│       │   └── LoanDetailPage.tsx  # Detalhes, pagamento, rollover, WhatsApp
│       ├── api.ts     # Cliente Axios tipado
│       ├── types.ts   # Tipos compartilhados
│       └── utils.ts   # Formatação monetária, datas, WhatsApp link
├── railway.toml
└── package.json
```
