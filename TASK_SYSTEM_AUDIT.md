# Task System — Pre-Implementation Audit

Audit of the repository against [TASK_SYSTEM_SPEC.md](TASK_SYSTEM_SPEC.md), performed 2026-07-21 on branch `feature/auth`. No application code was modified.

---

## 1. PREREQUISITE CHECK

### Phase 1 — Authentication: ✅ EXISTS, but ⚠️ UNCOMMITTED

Verified in code and by running the test suite (10/10 integration tests pass against the docker-compose Postgres):

- JWT auth is implemented: `server/src/services/auth.service.ts` (argon2id passwords, HS256 access tokens via `jose`, rotating refresh tokens hashed in the `RefreshToken` table, replay-safe rotation in a transaction).
- Protected routes exist: `server/src/middleware/require-auth.ts` verifies the Bearer token in a `preHandler` and attaches the user id.
- Endpoints live: `POST /api/v1/auth/signup|login|refresh|logout`, `GET|PATCH|DELETE /api/v1/me`.

**Deviations from the spec's assumption:**

- The authenticated id is exposed as **`request.userId`**, not `request.user.id`. The spec's wording must be read as `request.userId` throughout.
- **The entire auth implementation is uncommitted** — it sits as modified/untracked files on branch `feature/auth` (see `git status`). It must be committed and merged to `main` before Phase 3 starts, or Phase 3 will be built on a branch that can drift.
- Not implemented from Phase 1 (documented in CLAUDE.md, not blockers for Phase 3): Google OAuth, email verification, CSV export.
- **No client-side auth UI exists at all** (`client/src/features/auth/` contains only `.gitkeep`). The server API is ready, but no login/signup pages, no token storage, no authenticated fetch wrapper (`client/src/lib/api.ts` is a Phase 0 health-check stub). The spec's frontend (§6: `/today`, `/tasks`) cannot make authenticated calls until this exists.

### Phase 2 — Routine CRUD: ❌ DOES NOT EXIST

- No `routines.routes.ts`, no routine service, no shared routine schemas. Grep for "routine" in `server/src` matches only comments and the Prisma schema.
- Only the `Routine` **table** exists (Prisma model + migration applied).
- The client's "routines" from onboarding are a client-only Zustand store + deterministic preview; nothing is persisted.

**Conclusion: Phase 3 cannot start as specced.** Either implement minimal Routine CRUD first (recommended, small: list/create/get/patch/delete over an already-migrated table), or descope `routineId` linkage in Phase 3 to "column exists, validated if provided, no routine UI".

---

## 2. SCHEMA DIFF

Current schema: `server/prisma/schema.prisma` (migration `0_init` applied to the dev database).

### Existing `Task` model vs spec

| Aspect | Current | Spec | Action |
|---|---|---|---|
| `id` | `uuid` | `cuid` | **Keep `uuid`** — every model in the repo uses `@default(uuid()) @db.Uuid`; spec says "adapt to existing conventions" |
| `userId` | ❌ absent (only via routine) | required FK | **Add** (+ index changes below) |
| `routineId` | **required** FK | **nullable** FK | **Change to nullable** |
| `name` | `String` | `title` (1-200) | **Rename to `title`**; length enforced in Zod, not DB |
| `notes` | ❌ | nullable text ≤5000 | **Add** |
| `categoryId` | ❌ | nullable FK → TaskCategory | **Add** |
| `color` | ❌ | nullable hex | **Add** |
| `priority` | ❌ | enum LOW/MEDIUM/HIGH/URGENT default MEDIUM | **Add enum + column** |
| `targetTime` | `String?` "HH:mm" | `startTime`/`endTime` "HH:mm" | **Replace** `targetTime` → `startTime` + `endTime`. Wall-clock string convention already matches (comment in schema says "HH:mm in the user's timezone") |
| `durationMinutes` | ❌ | nullable int | **Add** |
| `daysOfWeek` | `Int[]` **ISO 1=Mon..7=Sun**, empty = every day | `recurrenceDays` `Int[]` **0=Sun..6=Sat** + explicit `recurrenceType` | **Replace** — see Conflict #5 (numbering) |
| `recurrenceType` | ❌ (implicit) | enum NONE/DAILY/WEEKLY/MONTHLY | **Add** |
| `recurrenceDayOfMonth` | ❌ | int 1-31 nullable | **Add** |
| `startDate` / `endDate` | ❌ | date / nullable date | **Add** |
| `sortOrder` | ✅ `Int @default(0)` | int | Keep as-is |
| `isArchived` | ❌ | bool default false | **Add** |
| `attachments` | ❌ | Json nullable, reserved | **Add** |
| `source` | ❌ | enum MANUAL/AI/EXTENSION default MANUAL | **Add enum + column** |
| timestamps | ✅ `createdAt`/`updatedAt` | same | Keep |
| Indexes | `@@index([routineId])` | `(userId, isArchived)`, `(routineId)`, `(userId, startDate)` | **Add the two userId indexes** |

### New models/enums (do not exist in any form)

- `TaskCategory` — new model. Needs `@@unique([userId, name])`, cascade on user delete (repo convention: every user-owned model cascades).
- `TaskInstance` — new model. `@@unique([taskId, date])`, `@@index([userId, date])`, `date` as `@db.Date` (repo already uses `@db.Date` on `Completion.date` and `Reflection.date` — same convention). Cascade from Task and User.
- Enums `Priority`, `RecurrenceType`, `TaskSource`, `TaskInstanceStatus` — repo already uses Prisma enums (`Plan`, `CompletionSource`), so this fits.

### Conflicts with existing migrations/fields

1. **`Completion.taskId` references `Task`, with `@@unique([taskId, date])`.** The spec says Completion "will later reference TaskInstance" (Phase 4). No change needed now, but the Phase 3 migration must NOT break this FK — renaming/retyping `Task.id` is off the table (another reason to keep `uuid`).
2. **"One additive migration" is not literally achievable**: making `routineId` nullable, renaming `name`→`title`, and dropping `targetTime`/`daysOfWeek` are ALTERs, not pure additions. The dev database has no real user data (only test rows that tests clean up), so a single migration containing these alters is safe. Flag: anyone with a seeded local DB re-runs from scratch or accepts the alters.
3. Prisma 7 quirks already solved in this repo (keep following them): datasource URL lives in `server/prisma.config.ts`, client generates into `server/src/generated/` (gitignored), migrations run via `npm run db:migrate -w server`.

---

## 3. PATTERN INVENTORY

Conventions the Task System must follow (all verified in current code):

- **Validation: Zod, not JSON Schema.** Request/response schemas live in `shared/src/schemas/*.ts`, re-exported from `shared/src/index.ts`; routes call `schema.parse(request.body)` and return `responseSchema.parse(...)`. Follow `shared/src/schemas/auth.ts` as the template.
- **Error envelope:** `{ error: { code, message } }`, produced centrally by `server/src/middleware/error-handler.ts`. Services throw typed `AppError`s from `server/src/services/errors.ts` (factory functions like `emailTakenError()`); ZodErrors map to `400 VALIDATION_ERROR`. ⚠️ The handler currently surfaces only the FIRST Zod issue — the spec's "400s list per-field messages" requires extending it (see Conflict #7).
- **Auth usage:** `{ preHandler: requireAuth }` per route; then `request.userId` (see `server/src/routes/me.routes.ts`). No global auth hook; each protected route opts in.
- **Route/service structure:** `server/src/routes/<domain>.routes.ts` — thin (parse → service/prisma → respond), registered in `app.ts` under prefix `/api/v1`. Stateful logic in `server/src/services/<domain>.service.ts` classes taking `(prisma, env)`. DTO mappers exported from route files (`toUserDto`). File names kebab-case.
- **Fastify decorations:** `app.env`, `app.prisma`, `app.authService` (typed via `declare module 'fastify'`). A task service would follow: `app.taskService` or plain functions — either fits; the service-class pattern is established.
- **Tests:** Vitest integration tests in `server/test/*.test.ts` using `buildApp(loadEnv())` + `app.inject(...)` against the real docker-compose Postgres, random per-run emails, `afterAll` cleanup. `NODE_ENV=test` silences the logger. No mocking layer exists — spec's integration tests should follow this exact pattern.
- **Frontend routing:** React Router v7, flat `<Routes>` in `client/src/app/App.tsx`. No layout-route or auth-guard pattern yet — Phase 3's `/today` and `/tasks` will need a protected-route wrapper that doesn't exist.
- **State management:** Zustand for client state (see `features/onboarding/store.ts`). **TanStack Query v5 IS installed and `QueryClientProvider` is already mounted** in `App.tsx`, but there are zero `useQuery`/`useMutation` usages so far — the spec's "add if absent" is satisfied; conventions (query-key factories, invalidation) are ours to establish.
- **Reusable UI:** `TimePicker.tsx` (12-hour AM/PM, canonical value `"HH:mm"` 24-hour — exactly what the spec's `startTime`/`endTime` columns store, so it plugs in directly), `SelectChip` (multi-select pills — fits weekday chips), `OptionCard`, `Button`, glass/violet Tailwind v4 styling, framer-motion with `useReducedMotion`.
- **Shared time helpers:** `client/src/features/onboarding/time.ts` (`parse24`/`to24`/`formatTime12`) — currently client-only; task views should reuse them (consider promoting to `shared/` if the server ever formats times — it shouldn't need to).
- **Not present anywhere:** `@fastify/rate-limit`, any Redis client (`ioredis`/`redis`), cursor pagination, drag-and-drop library. Redis itself runs in docker-compose but nothing connects to it yet; `REDIS_URL` is not in the env schema.

---

## 4. SPEC CONFLICTS AND OPEN QUESTIONS

1. **Phase 2 missing (blocker).** Spec assumes Routine CRUD; the repo has only the table. **Recommendation:** insert a "Phase 2-lite" step before Phase 3 — minimal `/api/v1/routines` CRUD (list/create/get/patch/delete, Zod schemas in `shared/`, integration tests), no client UI yet. ~Half a day; unblocks `routineId` validation and the editor's routine selector.
2. **Uncommitted auth work.** Everything from Phase 1 is sitting unstaged on `feature/auth`. **Recommendation:** commit, merge to `main` (per CLAUDE.md squash-merge flow), and branch `feature/task-system` from there before touching anything.
3. **`cuid` vs repo's `uuid`.** Spec says cuid; every existing model uses `uuid` (+ `@db.Uuid`), and `Completion` FKs into `Task.id` as UUID. **Recommendation:** use `uuid` — spec explicitly defers to repo conventions.
4. **`request.user.id` vs `request.userId`.** **Recommendation:** `request.userId` (existing decorator). Spec wording is descriptive, not literal.
5. **Weekday numbering.** Spec: `0=Sun..6=Sat`. Existing `Task.daysOfWeek`: ISO `1=Mon..7=Sun` (comment in schema). The column is being replaced anyway and no production data exists. **Recommendation:** adopt the spec's `0=Sun..6=Sat` for `recurrenceDays` (matches JS `Date.getDay()`, which `occursOn` will use), and delete the old column in the same migration. Document the numbering in the schema comment.
6. **"One additive migration" vs required ALTERs.** Renames/nullability changes to `Task` are not additive (see Schema Diff #2). **Recommendation:** accept one combined migration with alters; no data migration needed because no real data exists.
7. **Per-field 400 errors.** Current error handler emits a single message. **Recommendation:** extend the envelope additively to `{ error: { code, message, details?: [{ path, message }] } }` — existing clients/tests keep working; update `errorResponseSchema` in `shared/` accordingly.
8. **`Completion` → `TaskInstance` re-pointing.** Spec defers to Phase 4 but Phase 3 creates the model Completion will point at. **Recommendation:** leave `Completion` untouched in Phase 3 (it's unused so far); Phase 4 does the FK swap. Do NOT try to do it "while we're in there" — keeps the Phase 3 migration reviewable.
9. **Redis cache (spec §5) — first Redis consumer.** Nothing connects to Redis yet; adding it means a client lib, `REDIS_URL` in the env schema, lifecycle wiring, and test-environment handling. **Recommendation:** implement with `ioredis`, but **fail-open** (cache errors log and fall through to Postgres) and make the cache a small injectable module so tests can run without Redis. Alternatively, ship Phase 3 without the cache (60s TTL on a per-user query is a micro-optimization at current scale) and add it with the rate limiter; my recommendation is implement-but-fail-open since docker-compose already provides Redis.
10. **Rate limiting store.** `@fastify/rate-limit` defaults to in-memory (per-process). Single-instance deployment makes that fine now. **Recommendation:** in-memory keyed by `request.userId` (fall back to IP for unauthenticated), scoped to the task/category routers; move to the Redis store when horizontal scaling actually happens.
11. **"Today" date and timezone.** `GET /tasks/today?date=` — when `date` is omitted, "today" must be computed in the **user's** timezone (`User.timezone`, mandatory in schema; CLAUDE.md calls timezone bugs a first-class design constraint), never server time. **Recommendation:** make `date` optional; default = current date in the user's IANA timezone via `Intl.DateTimeFormat`.
12. **Category seeding point.** Spec: "seed 4 defaults per user" but doesn't say when. Options: (a) at signup — touches auth service; (b) lazily on first category/task read. **Recommendation:** (a) seed inside `AuthService.signup` in the same transaction as user creation (simple, deterministic), plus an idempotent "ensure defaults" guard in the category list endpoint for the handful of pre-existing dev/test users. Colors: pick 4 from the app's violet-friendly palette.
13. **Client auth UI is a hidden dependency of §6.** `/today` and `/tasks` are authenticated pages, but the client has no login/signup UI, no token handling, no authenticated fetch. **Recommendation:** add a minimal client auth slice (login/signup forms, access token in memory + refresh-on-401 via the httpOnly cookie flow, protected-route wrapper) as step 7a, before the task frontend. Without it, §6 is untestable end-to-end.
14. **`PATCH /task-instances/:id` status values.** Spec §4 says status changes limited to PENDING/SKIPPED "until Phase 4", while §6's checkbox "toggles PENDING/SKIPPED". Consistent — but note the enum still ships all four values (COMPLETED/RESCHEDULED) so Phase 4 is enum-stable; the endpoint just rejects them for now with a clear error. **Recommendation:** confirm this reading; implement a `422`/`400` with code `STATUS_NOT_AVAILABLE_YET` (or reuse `VALIDATION_ERROR`).
15. **Cursor pagination is new to the repo.** No existing pattern. **Recommendation:** standard Prisma cursor pattern (`cursor` = last item id, `orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }]` for a stable sort); return `{ items, nextCursor }`. Establish it here as the template for future lists.
16. **Drag-to-reorder library.** None installed. **Recommendation:** `@dnd-kit/core` + `@dnd-kit/sortable` (maintained, headless, works with the existing Tailwind styling); keep it scoped to the /tasks page.

---

## 5. REVISED IMPLEMENTATION ORDER

The spec's 8 steps survive, with three insertions at the front (0a–0c) and one split in step 7:

- **0a. Land Phase 1:** commit the auth work on `feature/auth`, squash-merge to `main`. *(Conflict #2)*
- **0b. Phase 2-lite — Routine CRUD API:** shared schemas + routes + service + integration tests for `/api/v1/routines`. No client UI. *(Conflict #1)*
- **0c. Error-handler extension:** per-field `details` in the 400 envelope + shared schema update. Tiny, but several later steps depend on it, so do it first. *(Conflict #7)*
1. **Migration + enums + seed default categories** — combined migration (additions + the `Task` alters from §2); seeding wired into signup + idempotent ensure-guard. *(Conflicts #3, #5, #6, #12)*
2. **`occursOn` helper + exhaustive unit tests** — pure function in `server/src/services/` (or `shared/` if the client will ever compute occurrences locally; server-only is fine to start). Uses `0=Sun..6=Sat`. First Vitest *unit* (non-DB) tests in the server package — trivial to add alongside the existing integration setup.
3. **Category CRUD** (`/task-categories`) + limits from the plan-config module (build the module here, not in step 4, since categories hit it first). *(§7)*
4. **Task CRUD + reorder + validation + plan limits** — includes cursor pagination pattern and ownership-as-404 helper. *(Conflicts #4, #15)*
5. **Materialization + `/tasks/today` + `/tasks/calendar`** — user-timezone date defaulting; Redis cache fail-open; rate limiter on the router (in-memory). *(Conflicts #9, #10, #11)*
6. **Instance override endpoint** — PENDING/SKIPPED only, typed rejection for Phase 4 statuses. *(Conflict #14)*
- **7a. Client auth slice** — login/signup pages, token handling, refresh-on-401, protected routes. *(Conflict #13)*
- **7b. Task frontend** — data layer (first real TanStack Query usage; establish key factories) → editor (reuse TimePicker/SelectChip) → /tasks page (dnd-kit) → /today view → category manager. *(Conflict #16)*
8. **Integration tests + manual QA** — follow the existing `server/test` inject-against-real-Postgres pattern; concurrency test for idempotent materialization; browser walkthrough of today/editor/reorder like the Phase-1-era Playwright drive.

**Estimated risk concentration:** steps 1–2 (schema semantics + recurrence correctness) and 5 (timezone + idempotency). Steps 3–4 and 6 are mechanical given the established patterns.
