# Midday Application - Complete Architecture Documentation

> **Gegenereerd op**: 2024-12-06
> **Doel**: Volledige technische documentatie voor het nabootsen van de Midday applicatie

---

## Inhoudsopgave

1. [Project Overzicht](#1-project-overzicht)
2. [Directory Structuur](#2-directory-structuur)
3. [Database & Schema](#3-database--schema)
4. [Authenticatie & Autorisatie](#4-authenticatie--autorisatie)
5. [Backend API](#5-backend-api)
6. [AI Integraties](#6-ai-integraties)
7. [UI/UX & Frontend](#7-uiux--frontend)
8. [Business Workflows](#8-business-workflows)
9. [Externe Integraties](#9-externe-integraties)
10. [Background Jobs](#10-background-jobs)
11. [Configuratie & Deployment](#11-configuratie--deployment)

---

## 1. Project Overzicht

### Wat is Midday?

Midday is een **all-in-one financial operations platform** voor bedrijven. Het combineert:
- Bankrekening synchronisatie
- Transactiebeheer
- Facturatie
- Tijdregistratie
- Document management
- AI-powered financiële inzichten

### Tech Stack Samenvatting

| Component | Technologie |
|-----------|-------------|
| **Runtime** | Bun 1.2.22 |
| **Monorepo** | Turbo 2.6.1 |
| **Frontend** | Next.js 16 + React 19 |
| **Backend API** | Hono.js + tRPC |
| **Database** | PostgreSQL (Supabase) |
| **ORM** | Drizzle ORM |
| **Cache** | Redis (Upstash) |
| **Background Jobs** | Trigger.dev v4 |
| **AI** | OpenAI + Google Generative AI |
| **Styling** | Tailwind CSS + Radix UI |
| **Desktop** | Tauri 2 |

---

## 2. Directory Structuur

### Monorepo Layout

```
midday/
├── apps/                          # 6 Applicaties
│   ├── dashboard/                 # Hoofd web applicatie (Next.js)
│   ├── api/                       # Backend API server (Hono + tRPC)
│   ├── engine/                    # Cloudflare Worker voor banking
│   ├── website/                   # Marketing website (Next.js)
│   ├── desktop/                   # Desktop app (Tauri + React)
│   └── docs/                      # API documentatie (Mintlify)
│
├── packages/                      # 23 Gedeelde packages
│   ├── db/                        # Database layer (Drizzle ORM)
│   ├── supabase/                  # Supabase client & queries
│   ├── cache/                     # Redis caching
│   ├── ui/                        # Component library (80+ componenten)
│   ├── invoice/                   # Factuur generatie
│   ├── inbox/                     # Email inbox integratie
│   ├── notifications/             # Notificatie systeem
│   ├── documents/                 # Document processing
│   ├── categories/                # Transactie categorieën
│   ├── import/                    # CSV/Excel import
│   ├── location/                  # Geografische data
│   ├── jobs/                      # Background jobs (Trigger.dev)
│   ├── app-store/                 # Slack integratie
│   ├── engine-client/             # Engine API client
│   ├── desktop-client/            # Desktop utilities
│   ├── events/                    # Analytics (OpenPanel)
│   ├── encryption/                # Data encryptie
│   ├── email/                     # Email templates (React Email)
│   ├── utils/                     # Algemene utilities
│   ├── logger/                    # Logging (Pino)
│   └── tsconfig/                  # TypeScript config
│
├── types/                         # Globale TypeScript types
├── docs/                          # Documentatie
├── .github/workflows/             # CI/CD pipelines (12 workflows)
│
├── package.json                   # Workspace configuratie
├── turbo.json                     # Turbo task configuratie
├── biome.json                     # Linter/formatter
└── tsconfig.json                  # TypeScript base config
```

### Apps Beschrijving

| App | Poort | Platform | Doel |
|-----|-------|----------|------|
| **dashboard** | 3001 | Vercel | Hoofd gebruikersinterface |
| **api** | 3003 | Fly.io | Backend API server |
| **engine** | 3002 | Cloudflare Workers | Banking aggregatie |
| **website** | 3000 | Vercel | Marketing site |
| **desktop** | - | Tauri | Native desktop app |
| **docs** | 3004 | Mintlify | API documentatie |

---

## 3. Database & Schema

### Database Technologie

- **Database**: PostgreSQL (via Supabase)
- **ORM**: Drizzle ORM v0.44.7
- **Migraties**: `/packages/db/migrations/`
- **Vector Support**: pgvector extensie voor embeddings

### Hoofd Tabellen (44 totaal)

#### Organisatie

```sql
-- Teams (workspaces)
teams (
  id UUID PRIMARY KEY,
  name TEXT,
  logo_url TEXT,
  inbox_id TEXT UNIQUE,
  email TEXT,
  base_currency TEXT DEFAULT 'USD',
  country_code TEXT,
  plan ENUM('trial', 'starter', 'pro'),
  created_at TIMESTAMP
)

-- Users (gekoppeld aan Supabase Auth)
users (
  id UUID PRIMARY KEY REFERENCES auth.users,
  full_name TEXT,
  avatar_url TEXT,
  email TEXT,
  team_id UUID REFERENCES teams,
  timezone TEXT,
  locale TEXT,
  date_format TEXT
)

-- Team membership
users_on_team (
  user_id UUID REFERENCES users,
  team_id UUID REFERENCES teams,
  role ENUM('owner', 'member'),
  PRIMARY KEY (user_id, team_id, id)
)
```

#### Banking & Transacties

```sql
-- Bank connecties
bank_connections (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams,
  institution_id TEXT,
  provider ENUM('gocardless', 'plaid', 'teller', 'enablebanking'),
  access_token TEXT ENCRYPTED,
  status ENUM('connected', 'disconnected', 'unknown'),
  error_details JSONB
)

-- Bankrekeningen
bank_accounts (
  id UUID PRIMARY KEY,
  bank_connection_id UUID REFERENCES bank_connections,
  account_id TEXT,
  name TEXT,
  balance NUMERIC,
  currency TEXT,
  type ENUM('depository', 'credit', 'other_asset', 'loan', 'other_liability'),
  enabled BOOLEAN DEFAULT true,
  error_retries INTEGER DEFAULT 0
)

-- Transacties (met full-text search)
transactions (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams,
  bank_account_id UUID REFERENCES bank_accounts,
  internal_id TEXT UNIQUE,
  date DATE,
  amount NUMERIC,
  currency TEXT,
  name TEXT,
  description TEXT,
  category_slug TEXT,
  status ENUM('posted', 'pending', 'excluded', 'completed', 'archived'),
  method ENUM('payment', 'card_purchase', 'card_atm', 'transfer', 'ach', ...),
  fts_vector TSVECTOR,  -- Full-text search
  UNIQUE(team_id, internal_id)
)

-- Transaction embeddings (voor AI matching)
transaction_embeddings (
  id UUID PRIMARY KEY,
  transaction_id UUID REFERENCES transactions,
  embedding VECTOR(768),  -- Google Gemini embeddings
  INDEX USING HNSW (embedding vector_cosine_ops)
)
```

#### Facturatie

```sql
-- Facturen
invoices (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams,
  customer_id UUID REFERENCES customers,
  invoice_number TEXT,
  status ENUM('draft', 'overdue', 'paid', 'unpaid', 'canceled', 'scheduled'),
  amount NUMERIC,
  currency TEXT,
  due_date DATE,
  paid_at TIMESTAMP,
  sent_at TIMESTAMP,
  line_items JSONB,
  payment_details JSONB,
  file_path TEXT,
  fts_vector TSVECTOR
)

-- Klanten
customers (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams,
  name TEXT,
  email TEXT,
  billing_email TEXT,
  phone TEXT,
  address_line_1 TEXT,
  city TEXT,
  country TEXT,
  vat_number TEXT,
  fts_vector TSVECTOR
)

-- Factuur templates
invoice_templates (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams UNIQUE,
  logo_url TEXT,
  payment_details JSONB,
  tax_rate NUMERIC,
  vat_rate NUMERIC,
  size ENUM('a4', 'letter')
)
```

#### Tijdregistratie

```sql
-- Projecten
tracker_projects (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams,
  customer_id UUID REFERENCES customers,
  name TEXT,
  description TEXT,
  rate NUMERIC,
  currency TEXT,
  estimate INTEGER,  -- in seconden
  status ENUM('in_progress', 'completed'),
  billable BOOLEAN DEFAULT true
)

-- Tijdregistraties
tracker_entries (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams,
  project_id UUID REFERENCES tracker_projects,
  assigned_id UUID REFERENCES users,
  date DATE,
  duration INTEGER,  -- in seconden
  start TIMESTAMP,
  stop TIMESTAMP,
  description TEXT,
  billed BOOLEAN DEFAULT false
)
```

#### Document Management

```sql
-- Documenten
documents (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams,
  name TEXT,
  title TEXT,
  body TEXT,
  summary TEXT,
  language TEXT,
  metadata JSONB,
  parent_id UUID REFERENCES documents,  -- folder structuur
  processing_status ENUM('pending', 'processing', 'completed', 'failed'),
  fts_vector TSVECTOR
)

-- Inbox items (email/receipts)
inbox (
  id UUID PRIMARY KEY,
  team_id UUID REFERENCES teams,
  transaction_id UUID REFERENCES transactions,  -- matched transaction
  amount NUMERIC,
  currency TEXT,
  date DATE,
  sender_email TEXT,
  display_name TEXT,
  status ENUM('processing', 'pending', 'archived', 'new', 'analyzing',
              'suggested_match', 'no_match', 'done'),
  type ENUM('invoice', 'expense'),
  fts_vector TSVECTOR
)

-- Inbox embeddings
inbox_embeddings (
  id UUID PRIMARY KEY,
  inbox_id UUID REFERENCES inbox,
  embedding VECTOR(768),
  INDEX USING HNSW (embedding vector_cosine_ops)
)
```

### Row Level Security (RLS)

Elke tabel heeft RLS policies:

```sql
-- Voorbeeld policy
CREATE POLICY "Users can only see their team data"
ON transactions
FOR ALL
USING (team_id IN (SELECT private.get_teams_for_authenticated_user()));
```

### Database Features

| Feature | Implementatie |
|---------|---------------|
| **Full-Text Search** | PostgreSQL tsvector + GIN indexes |
| **Vector Search** | pgvector met HNSW indexes (768 dimensies) |
| **Multi-tenancy** | Team-based RLS op alle tabellen |
| **Soft Deletes** | Status enums (geen harde deletes) |
| **Audit Trail** | Activities tabel met 20+ event types |
| **JSONB** | Flexibele schema's voor metadata, settings |

---

## 4. Authenticatie & Autorisatie

### Auth Provider: Supabase Auth

```
/packages/supabase/src/client/
├── server.ts     # Server-side Supabase client
└── client.ts     # Client-side Supabase client
```

### Login Methodes

| Methode | Component | Flow |
|---------|-----------|------|
| **Google OAuth** | `google-sign-in.tsx` | OAuth 2.0 redirect |
| **GitHub OAuth** | `github-sign-in.tsx` | OAuth 2.0 redirect |
| **Apple Sign In** | `apple-sign-in.tsx` | OAuth 2.0 redirect |
| **Email OTP** | `otp-sign-in.tsx` | Magic link via email |
| **Desktop** | `verify/page.tsx` | Code-based verificatie |

### Session Management

```typescript
// Middleware flow (apps/dashboard/src/middleware.ts)
1. updateSession() - Refresh Supabase cookies
2. Check MFA status (AAL2 level)
3. Validate team membership
4. Redirect if needed (/login, /mfa/verify, /teams/create)
```

### Role-Based Access Control (RBAC)

**Team Roles:**
- `owner` - Volledige toegang
- `member` - Beperkte toegang

**Permission Check:**
```typescript
// apps/api/src/trpc/middleware/team-permission.ts
const hasAccess = await hasTeamAccess(db, userId, teamId);
if (!hasAccess) throw new TRPCError({ code: "FORBIDDEN" });
```

### API Authenticatie (3 methodes)

```typescript
// apps/api/src/rest/middleware/auth.ts

// 1. Supabase JWT Token
Authorization: Bearer <JWT_TOKEN>
// Verified via SUPABASE_JWT_SECRET

// 2. OAuth Access Token
Authorization: Bearer mid_access_token_<TOKEN>
// Opgeslagen in database met scopes

// 3. API Key
Authorization: Bearer mid_<KEY>
// Gehashed opgeslagen, cached in Redis
```

### API Scopes

```typescript
const SCOPES = [
  "bank-accounts.read", "bank-accounts.write",
  "customers.read", "customers.write",
  "documents.read", "documents.write",
  "invoices.read", "invoices.write",
  "transactions.read", "transactions.write",
  "tracker-entries.read", "tracker-entries.write",
  "teams.read", "teams.write",
  "users.read", "users.write",
  "apis.all",    // Alle toegang
  "apis.read"    // Alleen lezen
];
```

### MFA Support

```typescript
// Supabase Authenticator TOTP
// Check in middleware:
if (mfaData.nextLevel === "aal2" && mfaData.currentLevel < "aal2") {
  redirect("/mfa/verify");
}
```

---

## 5. Backend API

### API Architectuur

De API gebruikt een **hybride aanpak**:

| Type | Framework | Gebruik |
|------|-----------|---------|
| **REST API** | Hono.js | Externe API, OpenAPI docs |
| **tRPC** | tRPC v11 | Interne dashboard communicatie |
| **Server Actions** | Next.js | Form submissions |
| **Webhooks** | Next.js Routes | Third-party integraties |

### REST API Endpoints (17 routers)

**Locatie**: `/apps/api/src/rest/routers/`

```
Financial Management:
├── /transactions      - CRUD, bulk operations, attachments
├── /invoices          - Invoice lifecycle management
├── /bank-accounts     - Account management

Contacts:
├── /customers         - Customer CRM

Organization:
├── /teams             - Team management
├── /users             - User profiles

Documents:
├── /documents         - File management
├── /inbox             - Email inbox

Time Tracking:
├── /tracker-entries   - Time entries
├── /tracker-projects  - Project management

AI & Search:
├── /chat              - AI chat (streaming)
├── /search            - Global search

Other:
├── /tags              - Categorization
├── /notifications     - Activity feed
├── /reports           - Financial reports
├── /transcription     - Audio transcription
└── /oauth             - OAuth flow
```

### tRPC Routers (34 routers)

**Locatie**: `/apps/api/src/trpc/routers/`

```typescript
// Main app router
export const appRouter = createTRPCRouter({
  transactions,
  invoices,
  customers,
  documents,
  inbox,
  chats,
  notifications,
  team,
  user,
  bankAccounts,
  bankConnections,
  tags,
  trackerEntries,
  trackerProjects,
  reports,
  search,
  apps,
  billing,
  oauthApplications,
  institutions,
  invoiceProducts,
  invoiceTemplate,
  widgets,
  notificationSettings,
  chatFeedback,
  documentTags,
  tagAssignments,
  transactionTags,
  categories,
  attachments,
  shortLinks,
  suggestedActions,
  apiKeys,
  inboxAccounts,
});
```

### Server Actions (22 actions)

**Locatie**: `/apps/dashboard/src/actions/`

```
├── ai/
│   ├── chat-action.ts
│   └── generate-csv-mapping.ts
├── transactions/
│   ├── manual-sync-transactions-action.ts
│   └── reconnect-connection-action.ts
├── mfa-verify-action.ts
├── verify-otp-action.ts
├── export-transactions-action.ts
├── send-feedback-action.ts
└── ...
```

### API Middleware Stack

```typescript
// REST API (Hono)
app.use("*", secureHeaders());
app.use("*", cors({ origins: ALLOWED_API_ORIGINS }));
app.use("*", withDatabase);
app.use("*", withAuth);
app.use("*", rateLimiter({ limit: 100, windowMs: 10 * 60 * 1000 }));
app.use("*", withPrimaryReadAfterWrite);

// Per-endpoint scope check
app.get("/transactions", withRequiredScope("transactions.read"), handler);
```

### Error Handling

```typescript
// REST API
throw new HTTPException(400, { message: "Invalid input" });
throw new HTTPException(404, { message: "Not found" });

// tRPC
throw new TRPCError({ code: "UNAUTHORIZED", message: "..." });
throw new TRPCError({ code: "NOT_FOUND", message: "..." });

// Server Actions (next-safe-action)
return { serverError: "Something went wrong" };
```

### Rate Limiting

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Protected API | 100 requests | 10 minuten |
| OAuth endpoints | 20 requests | 15 minuten |

---

## 6. AI Integraties

### AI Providers

| Provider | Gebruik | Model |
|----------|---------|-------|
| **OpenAI** | LLM Chat & Analysis | gpt-4o, gpt-4o-mini |
| **Google** | Embeddings | gemini-embedding-001 (768 dim) |
| **Mistral** | OCR & Classification | mistral-ocr-latest |

### AI SDK Stack

```json
{
  "ai": "5.0.87",
  "@ai-sdk/openai": "2.0.62",
  "@ai-sdk/google": "latest",
  "@ai-sdk/react": "2.0.82",
  "@ai-sdk-tools/agents": "1.2.0",
  "@ai-sdk-tools/memory": "1.2.0"
}
```

### Multi-Agent Systeem

**Locatie**: `/apps/api/src/ai/agents/`

```
Main Agent (Triage)
├── gpt-4o-mini, temp: 0.1
└── Routes naar specialist agents:
    │
    ├── General Agent (gpt-4o, temp: 0.8)
    │   └── Web search, PDF analysis
    │
    ├── Research Agent (gpt-4o, temp: 0.7)
    │   └── Affordability, market comparisons
    │
    ├── Reports Agent (gpt-4o-mini, temp: 0.3)
    │   └── 15 financial analysis tools
    │
    ├── Analytics Agent (gpt-4o, temp: 0.5)
    │   └── Health scores, forecasting
    │
    ├── Operations Agent (gpt-4o-mini, temp: 0.3)
    │   └── Accounts, documents, transactions
    │
    ├── Transactions Agent
    ├── Invoices Agent
    ├── Customers Agent
    └── Time Tracking Agent
```

### AI Tools (30+ tools)

**Financial Analysis:**
- `get-balance-sheet`, `get-burn-rate`, `get-business-health-score`
- `get-cash-flow`, `get-cash-flow-stress-test`, `get-expenses`
- `get-forecast`, `get-growth-rate`, `get-invoice-payment-analysis`
- `get-profit-analysis`, `get-revenue-summary`, `get-runway`
- `get-spending`, `get-tax-summary`

**Data Operations:**
- `get-account-balances`, `get-bank-accounts`, `get-transactions`
- `get-invoices`, `get-customers`, `get-documents`, `get-inbox`

**Time Tracking:**
- `create-tracker-entry`, `get-timer-status`, `stop-timer`

### Vector Embeddings (RAG)

```sql
-- Embedding tabellen met HNSW indexes
transaction_embeddings (embedding VECTOR(768))
inbox_embeddings (embedding VECTOR(768))
document_tag_embeddings (embedding VECTOR(768))
transaction_category_embeddings (embedding VECTOR(768))
```

**Gebruik:**
- Semantic transaction matching
- Document classification
- Category auto-suggestion
- Inbox-to-transaction matching

### AI Filter Generation

```typescript
// /apps/dashboard/src/app/api/ai/filters/
POST /api/ai/filters/transactions  // Natural language → filter
POST /api/ai/filters/invoices
POST /api/ai/filters/vault
POST /api/ai/filters/tracker
```

---

## 7. UI/UX & Frontend

### Component Library

**Base**: Radix UI (unstyled primitives)
**Styling**: Tailwind CSS + Class Variance Authority (CVA)
**Locatie**: `/packages/ui/`

### 80+ UI Componenten

```
Form Components:
├── Form, FormField, FormItem, FormLabel, FormControl
├── Input, Textarea, CurrencyInput, InputOTP
├── Select, ComboBox, MultipleSelector

Interactive:
├── Button (6 variants)
├── Dialog, Drawer, Popover, HoverCard
├── Tabs, Accordion, Collapsible
├── Checkbox, Switch, RadioGroup, Slider

Data Display:
├── Table (met TanStack React Table)
├── Chart (Recharts-based)
├── Badge, Alert, Card, Skeleton

AI Components:
├── Conversation, Message, Prompt-Input
├── Record-Button, Tool-Call-Indicator
├── WebSearch-Sources, Reasoning, Response

Advanced:
├── Editor (TipTap rich text)
├── DateRangePicker, Calendar
├── ContextMenu, DropdownMenu
└── Carousel (Embla-based)
```

### Design System

```css
/* /packages/ui/src/globals.css */
:root {
  --background: 0, 0%, 100%;
  --foreground: 0, 0%, 7%;
  --primary: 240 5.9% 10%;
  --destructive: 0 84.2% 60.2%;
  --border: 45, 5%, 85%;
  --radius: 0.5rem;
}

.dark {
  --background: 0, 0%, 5%;
  --foreground: 0 0% 98%;
}
```

### Layout Structuur

```tsx
// /apps/dashboard/src/app/[locale]/(app)/(sidebar)/layout.tsx
<div className="relative">
  <Sidebar />                    {/* 70px → 240px on hover */}
  <div className="md:ml-[70px] pb-4">
    <Header />                   {/* Sticky top */}
    <div className="px-4 md:px-8">
      {children}
    </div>
  </div>
  <ExportStatus />
  <GlobalSheets />
  <GlobalTimerProvider />
</div>
```

### State Management

| Layer | Technologie | Gebruik |
|-------|-------------|---------|
| **Server State** | tRPC + React Query | Data fetching, caching |
| **Client State** | Zustand | UI state (chat, selections) |
| **URL State** | nuqs | Filters, pagination, sorting |
| **Theme** | next-themes | Dark/light mode |

### Zustand Stores

```typescript
// /apps/dashboard/src/store/
├── chat.ts           // Chat interface state
├── transactions.ts   // Table selection
├── inbox.ts          // Inbox state
├── invoice.ts        // Invoice editor
├── vault.ts          // Document vault
├── search.ts         // Global search
└── export.ts         // Export status
```

### Form Handling

```typescript
// React Hook Form + Zod
const formSchema = z.object({
  name: z.string().min(1),
  amount: z.number(),
  currency: z.string(),
  date: z.string(),
});

const form = useForm({
  resolver: zodResolver(formSchema),
});
```

---

## 8. Business Workflows

### 8.1 Bank Synchronisatie

```
User connects bank
       ↓
OAuth/Link flow (Plaid/Teller/GoCardless/EnableBanking)
       ↓
Store credentials (encrypted)
       ↓
initial-bank-setup job
       ↓
Discover accounts → Create bank_accounts
       ↓
Schedule daily sync
       ↓
┌─────────────────────────────────────┐
│         SYNC CYCLE (daily)          │
├─────────────────────────────────────┤
│ sync-connection                     │
│    ↓                                │
│ For each account:                   │
│    ├── sync-account                 │
│    │     ├── Get balance            │
│    │     └── Get transactions       │
│    └── upsert-transactions          │
│          ├── Deduplicate            │
│          ├── Create embeddings      │
│          └── Match to inbox         │
│    ↓                                │
│ transaction-notifications (5m delay)│
└─────────────────────────────────────┘
```

### 8.2 Facturatie Workflow

```
Create Invoice
    ├── Draft: Save as draft
    ├── Create: Generate PDF immediately
    └── Scheduled: Create Trigger.dev job
          ↓
generate-invoice job
    ├── Fetch invoice + customer data
    ├── Calculate totals (subtotal, VAT, tax, discount)
    ├── Generate PDF (React-PDF)
    └── Upload to Supabase Storage
          ↓
[Optional] send-invoice-email job
    └── Send via Resend with PDF attachment
          ↓
Status tracking
    ├── Draft → Unpaid → Paid/Overdue
    └── invoice-scheduler (every 12h) checks payment status
          ↓
Payment matching
    └── Match transaction to invoice by amount/date
```

### 8.3 Inbox Matching (Bidirectioneel)

```
NEW TRANSACTION                 NEW INBOX ITEM
      ↓                               ↓
┌─────────────────────────────────────────────────┐
│         BIDIRECTIONAL MATCHING                  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Phase 1: Forward (Transaction → Inbox)         │
│  ├── Search inbox for matches                   │
│  └── Score: amount + currency + date + embedding│
│                                                 │
│  Phase 2: Reverse (Inbox → Transaction)         │
│  ├── Search transactions for matches            │
│  └── Calculate confidence scores                │
│                                                 │
│  Confidence > threshold?                        │
│  ├── Yes: Auto-match                           │
│  └── No: Create suggestion for user            │
│                                                 │
└─────────────────────────────────────────────────┘
```

### 8.4 Tijdregistratie

```
Start Timer
    ├── Record start time
    └── Associate with project/user
          ↓
Stop Timer
    ├── Calculate duration
    └── Create tracker_entry
          ↓
[Optional] Create Invoice from Tracker
    ├── Select project (billable)
    ├── Select date range
    ├── Calculate: hours × rate
    └── Generate invoice with line items
```

### 8.5 Document Processing

```
File Upload
    ↓
process-document job
    ├── Check MIME type
    ├── HEIC → JPG conversion (if needed)
    └── Route to classifier
          ↓
classify-document/classify-image job
    ├── AI classification (Gemini)
    └── Extract: title, summary, tags, date, language
          ↓
embed-document-tags job
    └── Create vector embeddings for search
          ↓
Document ready for search & retrieval
```

### 8.6 Import/Export

```
IMPORT (CSV)                    EXPORT
     ↓                               ↓
Parse CSV                      Select transactions
     ↓                               ↓
Map columns                    Batch processing (100/batch)
     ↓                               ↓
Validate & transform           Generate CSV + XLSX
     ↓                               ↓
Batch upsert (500/batch)       Create ZIP with attachments
     ↓                               ↓
Create embeddings              Upload to storage
     ↓                               ↓
Trigger matching               Create short link (7 days)
                                     ↓
                               Send email (optional)
```

---

## 9. Externe Integraties

### Banking Providers

| Provider | Regio | Protocol | Features |
|----------|-------|----------|----------|
| **Plaid** | US/Canada | OAuth | Full history, webhooks |
| **Teller** | US | Cert-pinned | Real-time, sandbox |
| **GoCardLess** | EU | PSD2 | Strong auth, token refresh |
| **EnableBanking** | Global | JWT | Session management |

**Unified Interface**: `/apps/engine/src/providers/index.ts`

### Payment Processing

**Polar** (Subscriptions)
- SDK: `@polar-sh/sdk`, `@polar-sh/nextjs`
- Webhook events: subscription.active, canceled, revoked
- Environment: `POLAR_ACCESS_TOKEN`, `POLAR_ENVIRONMENT`

### Email Services

**Resend** (Primary)
- Batch sending, attachments
- Templates: invoice, reminder, onboarding
- SDK: `resend`

**Postmark** (Inbound)
- Email forwarding webhook
- Inbox attachments processing

### AI Services

| Service | Gebruik |
|---------|---------|
| **OpenAI** | LLM chat, analysis |
| **Google Generative AI** | Embeddings (768 dim) |
| **Mistral AI** | OCR, document classification |

### Communication

**Slack Integration**
- SDK: `@slack/bolt`, `@slack/oauth`
- Features: Transaction notifications, file uploads

**Gmail API**
- Scopes: gmail.readonly, userinfo.email
- Token management with encryption

### Search & Cache

| Service | Gebruik |
|---------|---------|
| **Typesense** | Full-text search (multi-region) |
| **Upstash Redis** | Distributed caching |

### Monitoring

| Service | Gebruik |
|---------|---------|
| **Sentry** | Error tracking (10% sampling) |
| **OpenPanel** | Product analytics |

---

## 10. Background Jobs

### Job Queue: Trigger.dev v4.1.2

**Configuratie**: `/packages/jobs/trigger.config.ts`

```typescript
{
  runtime: "node",
  retries: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    factor: 2,  // exponential backoff
    randomize: true
  }
}
```

### Alle Jobs (42 totaal)

#### Bank/Financial (7 jobs)

| Job | Duration | Purpose |
|-----|----------|---------|
| `sync-connection` | 120s | Sync bank connection |
| `sync-account` | 120s | Sync individual account |
| `bank-sync-scheduler` | 120s | Daily scheduled sync |
| `initial-bank-setup` | 120s | Setup new connection |
| `delete-connection` | 60s | Cleanup connection |
| `upsert-transactions` | 120s | Insert/update transactions |
| `transaction-notifications` | 60s | Send notifications |

#### Invoice (8 jobs)

| Job | Duration | Purpose |
|-----|----------|---------|
| `generate-invoice` | 60s | Generate PDF |
| `send-invoice-email` | 30s | Send via email |
| `send-invoice-reminder` | 60s | Payment reminder |
| `schedule-invoice` | 60s | Schedule future invoice |
| `check-invoice-status` | - | Check payment status |
| `invoice-scheduler` | - | Cron: 0 0,12 * * * |
| `send-notifications` | 60s | Invoice events |

#### Document (5 jobs)

| Job | Purpose |
|-----|---------|
| `process-document` | Orchestrate processing |
| `classify-document` | AI classification |
| `classify-image` | Image classification |
| `convert-heic` | HEIC → JPG |
| `embed-document-tags` | Create embeddings |

#### Inbox (6 jobs)

| Job | Purpose |
|-----|---------|
| `process-attachment` | Process uploads |
| `match-transactions-bidirectional` | AI matching |
| `batch-process-matching` | Batch matching |
| `embed-inbox` | Create embeddings |
| `no-match-scheduler` | Cron: 0 2 * * * |
| `slack-upload` | Upload to Slack |

#### Transaction (7 jobs)

| Job | Purpose |
|-----|---------|
| `embed-transaction` | Create embeddings |
| `enrich-transaction` | AI enrichment |
| `export-transactions` | Generate export |
| `import-transactions` | Process CSV import |
| `process-attachment` | Receipt processing |
| `process-export` | Batch export |
| `update-base-currency` | Currency conversion |

### Scheduled Tasks (Cron)

| Task | Schedule | Purpose |
|------|----------|---------|
| `bank-sync-scheduler` | Daily | Sync all connections |
| `invoice-scheduler` | 0 0,12 * * * | Check invoice status |
| `rates-scheduler` | 0 0,12 * * * | Update exchange rates |
| `no-match-scheduler` | 0 2 * * * | Cleanup old unmatched |
| `inbox-sync-scheduler` | Every 6h | Sync email accounts |

### Webhook Handlers

| Endpoint | Provider | Events |
|----------|----------|--------|
| `/api/webhook/plaid` | Plaid | SYNC_UPDATES_AVAILABLE |
| `/api/webhook/teller` | Teller | transactions.processed |
| `/api/webhook/polar` | Polar | subscription.* |
| `/api/webhook/inbox` | Postmark | Inbound emails |

---

## 11. Configuratie & Deployment

### Deployment Platforms

| Service | Platform | Config File |
|---------|----------|-------------|
| Dashboard | Vercel | `vercel.json` |
| Website | Vercel | `vercel.json` |
| API | Fly.io | `fly.toml` |
| Engine | Cloudflare Workers | `wrangler.toml` |
| Jobs | Trigger.dev | `trigger.config.ts` |

### Environment Variables

**API Server** (`.env-template`):
```bash
# Database
DATABASE_PRIMARY_URL=
DATABASE_SESSION_POOLER=

# Supabase
SUPABASE_JWT_SECRET=
SUPABASE_SERVICE_KEY=
SUPABASE_URL=

# AI
OPENAI_API_KEY=
GOOGLE_GENERATIVE_AI_API_KEY=

# Services
RESEND_API_KEY=
ENGINE_API_URL=
ENGINE_API_KEY=

# Trigger.dev
TRIGGER_PROJECT_ID=
TRIGGER_SECRET_KEY=

# Config
ALLOWED_API_ORIGINS=
LOG_LEVEL=info
```

**Dashboard** (`.env-example`):
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_KEY=

# Banking
PLAID_CLIENT_ID=
PLAID_SECRET=
GOCARDLESS_SECRET_ID=
GOCARDLESS_SECRET_KEY=
TELLER_CERTIFICATE=
TELLER_SIGNING_SECRET=

# Cache
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=
NEXT_PUBLIC_OPENPANEL_CLIENT_ID=

# Payment
POLAR_ACCESS_TOKEN=
POLAR_WEBHOOK_SECRET=
```

### Docker (API)

```dockerfile
# apps/api/Dockerfile
FROM oven/bun:1.2.22
# Multi-stage build
# Dependencies: python3, cairo, pango, libjpeg, gif, rsvg
# Port: 8080
```

### CI/CD (GitHub Actions)

**12 Workflows**:
- `production-dashboard.yml` → Vercel
- `production-api.yaml` → Fly.io
- `production-engine.yml` → Cloudflare Workers
- `production-jobs.yml` → Trigger.dev
- `production-website.yml` → Vercel
- `production-desktop.yaml` → Tauri release
- `beta-dashboard.yaml` → Preview
- `preview-*` → Staging environments

### Monitoring & Logging

| Tool | Gebruik |
|------|---------|
| **Sentry** | Error tracking (10% traces, 100% error replay) |
| **Pino** | Structured logging |
| **Health endpoints** | `/health`, `/health/db`, `/health/pools` |

### Security

```typescript
// Rate Limiting
Protected API: 100 req / 10 min / user
OAuth: 20 req / 15 min / IP

// CORS
origins: ALLOWED_API_ORIGINS (comma-separated)
methods: GET, POST, PUT, DELETE, OPTIONS, PATCH

// Headers
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
```

### Multi-Tenancy

- Team-based data isolation
- RLS policies op alle tabellen
- Team cache in Redis (30 min TTL)
- Scope-based API toegang

---

## Samenvatting Statistieken

| Categorie | Aantal |
|-----------|--------|
| **Apps** | 6 |
| **Packages** | 23 |
| **Database Tabellen** | 44 |
| **REST Endpoints** | 17 routers |
| **tRPC Routers** | 34 |
| **Server Actions** | 22 |
| **Background Jobs** | 42 |
| **UI Componenten** | 80+ |
| **AI Agents** | 9 |
| **AI Tools** | 30+ |
| **External Integrations** | 20+ |
| **CI/CD Workflows** | 12 |

---

## Key Architectuur Patronen

1. **Event-Driven**: Jobs triggered by events en schedules
2. **Batch Processing**: 100-500 items per batch
3. **Multi-Provider**: Abstracte interfaces voor banking
4. **Vector Search**: AI-powered matching met embeddings
5. **Multi-Tenancy**: Team-based RLS isolation
6. **Hybrid API**: REST + tRPC + Server Actions
7. **Type Safety**: End-to-end TypeScript + Zod
8. **Monorepo**: Shared packages via Turbo
9. **Edge Computing**: Cloudflare Workers voor banking
10. **Real-time**: Supabase subscriptions

---

*Deze documentatie biedt een complete blauwdruk voor het nabootsen van de Midday applicatie.*
