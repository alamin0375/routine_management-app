# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Vision

An AI-powered Routine Management App that helps students and professionals create, follow, and track daily routines.

Core goals:

- **Create** — users build routines from templates or from scratch; the AI assistant suggests routines based on the user's goals, schedule, and habits.
- **Follow** — daily checklists, reminders, and gentle nudges keep users on track without being intrusive.
- **Track** — streaks, completion stats, and AI-generated weekly insights show progress and suggest adjustments.

Guiding principles:

- Low-friction first: logging a completed task should take one tap/click.
- AI assists, never dictates: suggestions are always editable and dismissible.
- Privacy-conscious: routine data is personal; minimize what leaves the user's account.

## Planned Technology Stack

*The project is in the planning stage — no application code exists yet. This stack is the intended direction; update this section if decisions change.*

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript (Vite), Tailwind CSS |
| State management | Zustand (client state), TanStack Query (server state) |
| Backend | Node.js + TypeScript, Fastify (see TECHNICAL_ARCHITECTURE.md) |
| Database | PostgreSQL via Prisma ORM |
| Auth | JWT-based auth (consider Auth.js / Clerk later) |
| AI features | Anthropic Claude API (`claude-sonnet-5` for routine suggestions and insights) |
| Testing | Vitest (unit), Playwright (e2e) |
| Formatting/Linting | Prettier + ESLint |
| Package manager | npm |

## Coding Rules

- **TypeScript everywhere.** Strict mode on (`"strict": true`). No `any` unless justified with a comment.
- **Small, focused modules.** One component/service per file; keep files under ~300 lines.
- **Naming.** `PascalCase` for components and types, `camelCase` for functions and variables, `kebab-case` for file names (except React components, which use `PascalCase.tsx`).
- **Validation at boundaries.** Validate all API input with Zod schemas; never trust client data.
- **Error handling.** No silent catches. Surface errors to the user with actionable messages; log details server-side.
- **AI calls are isolated.** All Claude API usage lives in a dedicated `ai/` service layer — never call the API directly from routes or components. API keys come from environment variables, never committed.
- **Tests accompany features.** New logic ships with unit tests; user-facing flows get e2e coverage.
- **No premature abstraction.** Duplicate twice before extracting a shared helper.

## Folder Organization

Planned monorepo-lite layout (adjust as the project takes shape):

```
routine-management-app/
├── CLAUDE.md
├── README.md
├── client/                  # React frontend
│   └── src/
│       ├── components/      # Reusable UI components
│       ├── features/        # Feature modules (routines, tracking, insights)
│       ├── hooks/           # Shared custom hooks
│       ├── lib/             # API client, utilities
│       └── pages/           # Route-level views
├── server/                  # Node backend
│   └── src/
│       ├── routes/          # Express route definitions
│       ├── services/        # Business logic
│       ├── ai/              # Claude API integration (suggestions, insights)
│       ├── db/              # Prisma schema and data access
│       └── middleware/      # Auth, validation, error handling
├── shared/                  # Types and Zod schemas shared by client & server
└── docs/                    # Design notes, ADRs
```

Rules:

- Feature code lives under `features/<feature-name>/` on the client; avoid a giant flat `components/` folder.
- Shared request/response types and schemas go in `shared/` — never duplicate them on both sides.
- No cross-imports from `client/` into `server/` or vice versa; only `shared/` is common.

## Development Workflow (Git)

- **`main` is always deployable.** Never commit directly to `main`.
- **Branch naming:** `feature/<short-description>`, `fix/<short-description>`, `chore/<short-description>` (e.g., `feature/routine-templates`).
- **Commits:** Conventional Commits format — `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`. Keep commits small and self-contained.
- **Flow:**
  1. Branch off `main`.
  2. Commit incrementally with clear messages.
  3. Run lint and tests locally before pushing (`npm run lint && npm test`).
  4. Open a PR into `main`; PRs need a short description of *what* and *why*.
  5. Squash-merge after review; delete the branch.
- **Never commit:** `.env` files, API keys, `node_modules/`, build output.

## Current Status

Planning stage. Only this CLAUDE.md exists — no application code yet. Next steps: scaffold `client/` and `server/`, set up Prisma schema for users and routines.
