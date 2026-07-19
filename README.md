# Routine Management App

AI-powered routine management for students and professionals — create, follow, and track daily routines with an AI coach that adapts to how your week actually goes.

**Status: Phase 0 (project scaffold).** No features yet — just the monorepo structure, tooling, and a health-check endpoint proving the client ↔ server ↔ shared-schema wiring.

## Project documents

| Document | Contents |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Coding rules, conventions, Git workflow |
| [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) | Personas, features, MVP scope, risks |
| [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) | Architecture, API design, development phases |

## Repository layout

```
client/    React + TypeScript + Vite frontend (Tailwind, TanStack Query, Zustand)
server/    Fastify + TypeScript API server
shared/    Zod schemas + types shared by client and server (single source of truth for API contracts)
docs/adr/  Architecture decision records
```

npm workspaces monorepo — one `npm install` at the root installs everything.

## Prerequisites

- Node.js ≥ 20 (`node --version`)
- npm ≥ 10 (ships with Node 20)

No database or other services are needed yet (Postgres/Redis arrive in Phase 1+).

## Getting started

```bash
# 1. Install all workspace dependencies
npm install

# 2. Configure the server environment
cp server/.env.example server/.env   # defaults work for local dev

# 3. Run client + server together
npm run dev
```

- Client: http://localhost:5173 — shows a status page that pings the API
- Server: http://localhost:3000 — health check at `GET /api/v1/health`

The Vite dev server proxies `/api/*` to the backend, so the client never needs CORS or an API URL in dev.

To run one side only: `npm run dev:client` or `npm run dev:server`.

## Everyday commands (from the repo root)

| Command | What it does |
|---|---|
| `npm run dev` | Run client and server in parallel with hot reload |
| `npm run typecheck` | Typecheck all workspaces |
| `npm run lint` | ESLint over the whole repo |
| `npm run format` | Prettier over the whole repo |
| `npm run build` | Build shared → server → client |
| `npm run test` | Run tests in all workspaces (none yet in Phase 0) |

## Environment variables

Server config lives in `server/.env` (see [server/.env.example](server/.env.example)); it is validated with Zod at boot, so missing/invalid values fail fast. Never commit `.env` files.

## Contributing

Follow the Git workflow in [CLAUDE.md](CLAUDE.md): branch off `main` (`feature/...`, `fix/...`), Conventional Commits, lint + typecheck before pushing, PR with squash-merge.
