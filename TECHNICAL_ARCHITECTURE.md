# TECHNICAL_ARCHITECTURE.md

Technical architecture for the AI-Powered Routine Management App. Companion to [CLAUDE.md](CLAUDE.md) (coding rules, workflow) and [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) (what and why). This document covers *how* we build it. It describes the target design — no code exists yet.

## 1. High-Level Overview

```
┌─────────────────┐        HTTPS/JSON        ┌──────────────────────┐
│  React PWA       │ ◄──────────────────────► │  Node.js API server  │
│  (client/)       │      REST + JWT          │  (server/)           │
└─────────────────┘                          │                      │
        ▲                                     │  ┌────────────────┐  │
        │ Web Push /                          │  │ AI service     │──┼──► Anthropic
        │ email digests                       │  │ layer (ai/)    │  │    Claude API
        │                                     │  └────────────────┘  │
┌─────────────────┐                          └──────────┬───────────┘
│ Notification     │ ◄────────────────────────────┐     │ Prisma
│ workers (jobs)   │                              │     ▼
└─────────────────┘                          ┌──────────────────────┐
                                             │  PostgreSQL          │
                                             └──────────────────────┘
```

Principles:

- **Monorepo, two deployables** (client + server) sharing types via `shared/`.
- **Boring, proven tech** — the product risk is retention and AI quality, not infrastructure novelty.
- **AI behind our API, never from the browser** — keys stay server-side, usage is metered per user.
- **PWA-first** — one codebase for desktop and mobile in v1; native apps only if push notifications prove inadequate (see PRD risks).

## 2. Frontend Technology Choice

**React 18 + TypeScript, built with Vite. Tailwind CSS. Installable PWA.**

| Concern | Choice | Rationale |
|---|---|---|
| Framework | React + Vite | Huge ecosystem, fast dev loop; SSR (Next.js) adds complexity we don't need — the app is behind auth, so SEO is irrelevant |
| Styling | Tailwind CSS + a small component layer | Fast iteration; consistent design without a heavy UI kit |
| Client state | Zustand | Minimal boilerplate for UI state (checklist interactions, modals) |
| Server state | TanStack Query | Caching, optimistic updates (critical for one-tap completion feeling instant), retry logic |
| Routing | React Router | Standard SPA routing |
| Forms/validation | React Hook Form + Zod | Zod schemas shared with the server from `shared/` |
| PWA | vite-plugin-pwa | Installability, offline shell, service worker for web push |
| Charts | Recharts | Completion calendar, trends (premium stats later) |

Key frontend behaviors:

- **Optimistic completion:** checking off a task updates UI instantly, syncs in background, rolls back on failure.
- **Offline tolerance (MVP-lite):** today's checklist cached by the service worker; completions queue and sync when back online. Full offline-first sync is *not* an MVP goal.

## 3. Backend Technology Choice

**Node.js + TypeScript with Fastify.**

- **Why Node/TS:** one language across the stack, shared Zod schemas and types via `shared/`, largest talent/ecosystem pool for this class of app.
- **Why Fastify over Express:** first-class TypeScript support, built-in schema validation hooks (pairs naturally with Zod), better performance, still boring and well-documented. (CLAUDE.md listed "Express or Fastify" — this document settles on **Fastify**.)
- **Runtime shape:** a single stateless API server, horizontally scalable. No microservices — the domain is small.
- **Background jobs:** BullMQ (Redis-backed) for scheduled work: reminder dispatch, weekly summary generation, AI insight batching. Runs as a worker process alongside the API in the same deployable initially.
- **Notifications:** web push (`web-push` library, VAPID) with email fallback (Resend or SES) per the PRD's delivery-risk mitigation.

## 4. Database Choice

**PostgreSQL, accessed via Prisma ORM.**

- Relational fits the domain: users → routines → tasks → completions is naturally relational with clear integrity constraints.
- Postgres specifics we'll lean on: date/timezone handling for scheduling, JSONB for flexible fields (AI conversation snippets, reflection metadata), window functions for streak/stats queries.
- **Redis** alongside for BullMQ queues, rate-limit counters, and AI-quota counters. Not a source of truth.

### Core data model (conceptual)

```
User          (id, email, auth fields, timezone, plan, created_at)
Routine       (id, user_id, name, is_active, archived_at)
Task          (id, routine_id, name, target_time, days_of_week[], sort_order)
Completion    (id, task_id, user_id, date, completed_at, source)   -- one row per task per day
Reflection    (id, user_id, date, mood, note?)                     -- optional daily 10-sec check-in
AiInteraction (id, user_id, kind, tokens_in, tokens_out, created_at) -- metering + cost tracking
PushSub       (id, user_id, endpoint, keys)                        -- web push subscriptions
```

Notes:

- **Streaks are computed, not stored** — derived from `Completion` with SQL window functions; cache in Redis if hot. Avoids corruption bugs and makes "flexible streaks" (premium) a pure calculation change.
- **Timezone is per-user and mandatory** — every "day" boundary calculation uses the user's timezone, never server time. This is the classic routine-app bug; treat it as a first-class design constraint.
- All user data deletable via cascade (GDPR "delete my data" from day one, per PRD).

## 5. Authentication Approach

**JWT access tokens + rotating refresh tokens, with OAuth (Google) alongside email/password.**

- **Access token:** short-lived (15 min) JWT, sent as `Authorization: Bearer`, stateless verification in the API.
- **Refresh token:** long-lived, stored in an `httpOnly` `Secure` `SameSite=Strict` cookie, rotated on every use, revocable server-side (stored hashed in Postgres).
- **Passwords:** argon2id hashing. Email verification required before AI features unlock (abuse control).
- **OAuth:** Google first (covers both students and professionals); designed so adding providers later is additive.
- **Authorization model:** simple — every resource row carries `user_id`; middleware enforces ownership on every query. No roles/teams in v1 (matches PRD scope).
- **Escape hatch:** if auth engineering drags on MVP timeline, swap to a hosted provider (Clerk/Auth.js) — the API only depends on "a verified `user_id` per request," so this stays an implementation detail.

## 6. Folder Structure

Refines the layout sketched in CLAUDE.md:

```
routine-management-app/
├── CLAUDE.md
├── PRODUCT_REQUIREMENTS.md
├── TECHNICAL_ARCHITECTURE.md
├── package.json                 # npm workspaces root
├── client/
│   ├── public/                  # icons, manifest
│   └── src/
│       ├── app/                 # app shell, router, providers
│       ├── components/          # reusable presentational UI
│       ├── features/
│       │   ├── auth/            # login, signup, session handling
│       │   ├── routines/        # routine CRUD, editor
│       │   ├── checklist/       # daily view, one-tap completion
│       │   ├── tracking/        # streaks, calendar, weekly summary
│       │   └── ai-coach/        # onboarding chat, suggestion UI
│       ├── hooks/
│       ├── lib/                 # API client, query client, push registration
│       └── styles/
├── server/
│   ├── prisma/                  # schema.prisma, migrations, seed
│   └── src/
│       ├── app.ts               # Fastify instance assembly (no listen)
│       ├── index.ts             # entrypoint
│       ├── routes/              # thin: parse → call service → respond
│       │   ├── auth.routes.ts
│       │   ├── routines.routes.ts
│       │   ├── completions.routes.ts
│       │   ├── stats.routes.ts
│       │   └── ai.routes.ts
│       ├── services/            # business logic, one per domain
│       ├── ai/                  # ALL Claude API usage lives here
│       │   ├── client.ts        # SDK wrapper, retries, timeouts
│       │   ├── prompts/         # versioned prompt templates
│       │   ├── quota.ts         # per-user metering (Redis counters)
│       │   └── suggestRoutine.ts, weeklyInsights.ts, ...
│       ├── jobs/                # BullMQ processors (reminders, summaries)
│       ├── db/                  # Prisma client, query helpers
│       ├── middleware/          # auth, rate limiting, error handler
│       └── config/              # env parsing (validated with Zod at boot)
├── shared/
│   └── src/
│       ├── schemas/             # Zod schemas: requests, responses, entities
│       └── types/               # inferred TS types
└── docs/
    └── adr/                     # architecture decision records
```

Rules (restating the load-bearing ones from CLAUDE.md):

- Routes are thin; logic lives in `services/`; Claude calls only in `ai/`.
- `shared/` is the single source of truth for API contracts — client and server both import from it; no duplicated types.
- No imports between `client/` and `server/`.

## 7. API Design

**REST, JSON, versioned under `/api/v1`.** REST over GraphQL/tRPC: the resource model is simple, caching semantics are clear, and `shared/` Zod schemas already give us end-to-end types without extra machinery.

### Conventions

- Auth: `Authorization: Bearer <access-token>` on all non-auth routes.
- Validation: every request body/query validated against a `shared/` Zod schema; invalid → `400` with field-level errors.
- Errors: consistent envelope `{ "error": { "code": "ROUTINE_LIMIT_REACHED", "message": "..." } }`; machine-readable `code` so the client can trigger e.g. the upgrade moment.
- Dates: ISO 8601; "day" parameters are `YYYY-MM-DD` interpreted in the user's timezone.
- Rate limiting: per-user on all routes; strict per-user quotas on `/ai/*`.

### Endpoints (MVP)

```
Auth
  POST   /api/v1/auth/signup            email+password signup
  POST   /api/v1/auth/login             → access token (+ refresh cookie)
  POST   /api/v1/auth/refresh           rotate refresh, new access token
  POST   /api/v1/auth/logout            revoke refresh token
  GET    /api/v1/auth/google | /callback  OAuth flow

User
  GET    /api/v1/me                     profile, plan, timezone
  PATCH  /api/v1/me                     update timezone, preferences
  DELETE /api/v1/me                     full account + data deletion (GDPR)
  GET    /api/v1/me/export              CSV export

Routines
  GET    /api/v1/routines               list (active + archived)
  POST   /api/v1/routines               create (enforces free-tier cap → 403 ROUTINE_LIMIT_REACHED)
  GET    /api/v1/routines/:id
  PATCH  /api/v1/routines/:id
  DELETE /api/v1/routines/:id
  POST   /api/v1/routines/:id/tasks     add task
  PATCH  /api/v1/tasks/:id
  DELETE /api/v1/tasks/:id

Daily checklist & completions
  GET    /api/v1/checklist?date=YYYY-MM-DD    today's tasks + completion state
  PUT    /api/v1/completions                  { taskId, date, completed } — idempotent toggle
  POST   /api/v1/reflections                  { date, mood, note? }

Stats
  GET    /api/v1/stats/streaks
  GET    /api/v1/stats/calendar?month=YYYY-MM
  GET    /api/v1/stats/weekly?week=YYYY-Www   basic numeric summary

AI
  POST   /api/v1/ai/suggest-routine     { goals, scheduleDescription } → proposed routine (editable draft, NOT auto-saved)
  POST   /api/v1/ai/refine-routine      { draftId, message } → revised draft (conversational loop)
  GET    /api/v1/ai/quota               remaining free-tier AI usage

Notifications
  POST   /api/v1/push/subscribe         register web push subscription
  DELETE /api/v1/push/subscribe
```

Design notes:

- `PUT /completions` is **idempotent** — double-taps and offline replays can't double-count.
- AI endpoints return **drafts the user explicitly accepts** — the AI never mutates routines directly (PRD principle: "AI assists, never dictates").
- The free-tier caps surface as typed error codes, which is exactly the instrumentation the PRD wants for upgrade-moment analytics.

## 8. AI Integration Approach

All AI functionality flows through the `server/src/ai/` layer using the **Anthropic TypeScript SDK**.

### Architecture rules

1. **Server-side only.** The browser never talks to Anthropic; keys live in server env.
2. **One wrapper client** (`ai/client.ts`): timeouts, retries with backoff, error normalization, token accounting into `AiInteraction`.
3. **Versioned prompts.** Prompt templates live in `ai/prompts/` as code-reviewed files; every change is a diff. Prompts embed user context (goals, timezone, schedule, recent completion stats) — never raw chat history from other features.
4. **Structured output.** Routine generation uses tool-use/structured output so the model returns a JSON routine draft matching a `shared/` Zod schema; we validate before showing it. Malformed output → one retry → graceful fallback to templates.
5. **Metering & cost control** (`ai/quota.ts`): per-user counters in Redis enforce free-tier caps (1 suggestion/week per PRD); every call logs tokens for unit-economics tracking.
6. **Safety boundaries:** system prompts constrain the coach to routine/productivity topics; refuse medical/clinical advice with a supportive redirect; user text is treated as data (delimited, never as instructions) to blunt prompt injection.

### Model selection

| Feature | Model | Why |
|---|---|---|
| Routine generation & refinement (MVP) | `claude-sonnet-5` | Quality matters at the make-or-break activation moment |
| Weekly insights (post-MVP, batch) | `claude-sonnet-5`, batched | Runs weekly per user in a job — latency-insensitive, cost amortized |
| Cheap classification (e.g., routing, moderation) | `claude-haiku-4-5-20251001` | Fast/cheap where quality bar is lower |

Re-evaluate model choices when premium launches; caching common template-like suggestions (per the PRD cost risk) is a planned optimization.

### Data flow example — onboarding suggestion

```
Client: POST /ai/suggest-routine {goals, scheduleDescription}
  → route validates via shared schema, checks quota
  → ai/suggestRoutine.ts builds prompt (template + user context)
  → Claude (structured output) → RoutineDraft JSON
  → Zod-validate draft, log AiInteraction, return draft
Client renders editable draft → user accepts → POST /routines (normal CRUD path)
```

## 9. Development Phases

Aligned with the PRD's MVP scoping. Each phase ends in something runnable and testable.

### Phase 0 — Foundations (repo skeleton)
- npm workspaces monorepo; `client/`, `server/`, `shared/` scaffolds.
- Prisma schema + first migration; Docker Compose for Postgres/Redis locally.
- CI: lint, typecheck, unit tests on every PR. Deployment target picked (e.g., client on Vercel/static host, server + Postgres + Redis on Railway/Render/Fly).
- **Exit:** `npm run dev` boots client and server; a health-check endpoint responds; CI green.

### Phase 1 — Auth & user model
- Signup/login/refresh/logout, Google OAuth, email verification, `me` endpoints, account deletion.
- **Exit:** a user can create an account, log in from the client, and delete their account.

### Phase 2 — Core loop: routines & checklist
- Routine/task CRUD (with free-tier cap), daily checklist with optimistic one-tap completion, timezone-correct day boundaries.
- **Exit:** a user can build a routine by hand and check off tasks day by day. *This is the product's spine — extra polish and test depth here.*

### Phase 3 — Tracking
- Streak computation, completion calendar, basic weekly numeric summary, reflections, CSV export.
- **Exit:** a week of dogfooding data renders correctly across timezones.

### Phase 4 — AI onboarding coach (the differentiator)
- `ai/` layer: client wrapper, prompts, quota metering; suggest + refine endpoints; onboarding chat UI producing an editable draft.
- Prompt-quality test harness: a fixture set of realistic personas/goals with review of generated routines (PRD risk: "AI suggestions feel generic").
- **Exit:** a new user goes from signup → AI-proposed routine → accepted & editable in under 3 minutes.

### Phase 5 — Reminders & MVP hardening
- Web push + email digest fallback, BullMQ scheduling in user timezones, notification preferences.
- E2E tests (Playwright) over the activation journey; load sanity checks; error tracking (Sentry); analytics events for activation/retention/upgrade-moment metrics from the PRD.
- **Exit: MVP launchable.** Success criteria instrumented (day-1 activation, week-4 retention).

### Phase 6+ — Post-MVP (per PRD "Future Features")
- AI weekly insights → payments/premium → adaptive reminders → calendar sync → mobile decision (native vs. enhanced PWA), driven by MVP metrics.

---

*Open questions to resolve during Phase 0: hosting provider choice, email provider choice, and whether to buy vs. build auth (see §5 escape hatch). Record decisions as ADRs in `docs/adr/`.*
