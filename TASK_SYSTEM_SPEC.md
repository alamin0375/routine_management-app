# Task System — Implementation Specification

Phase 3. Assumes Phase 1 (JWT auth, authenticated userId on every request) and
Phase 2 (Routine CRUD) are complete.

## 1. Scope

IN SCOPE: Task CRUD (standalone + routine-linked), recurrence (daily/weekly/
monthly), priority, categories, color labels, notes, task ordering, task
instance materialization, validation, authorization, rate limiting, frontend
task list + task editor + today view.

OUT OF SCOPE: attachments (reserve a nullable attachments Json field, no upload
endpoints), completion logic/streaks (Phase 4), AI scheduling (Phases 9-10),
smart rescheduling.

## 2. Domain Model

Two-level design — the most important decision in this phase:
- Task = a template ("Study React, weekdays, 19:00-20:00"). Never checked off.
- TaskInstance = one occurrence of a Task on a specific date. This is what the
  user completes. The existing Completion model will later reference
  TaskInstance, not Task.
- TaskCategory = user-owned grouping (Study, Health, ...) with a color.

### Prisma changes (describe-level; adapt to existing schema conventions)

Task (extend/replace existing stub):
- id (cuid), userId (FK User, required), routineId (FK Routine, NULLABLE —
  standalone tasks allowed)
- title (string 1-200), notes (text nullable, max 5000)
- categoryId (FK TaskCategory, nullable), color (nullable hex, overrides
  category color)
- priority enum: LOW | MEDIUM | HIGH | URGENT, default MEDIUM
- startTime / endTime: nullable strings "HH:mm", user-local wall-clock time
  (NOT UTC instants — routines are wall-clock concepts, must survive DST)
- durationMinutes (nullable int, used when times unset)
- recurrenceType enum: NONE | DAILY | WEEKLY | MONTHLY
- recurrenceDays (int[] weekdays 0=Sun..6=Sat, for WEEKLY)
- recurrenceDayOfMonth (int 1-31, for MONTHLY; shorter month -> last day)
- startDate (date), endDate (date nullable = forever)
- sortOrder (int), isArchived (bool default false, soft delete)
- attachments (Json nullable, reserved)
- source enum: MANUAL | AI | EXTENSION, default MANUAL (future-proofs the
  Chrome extension and AI generator as writers into the same pipeline)
- createdAt, updatedAt
- Indexes: (userId, isArchived), (routineId), (userId, startDate)

TaskCategory (new): id, userId, name (1-50, unique per user), color (hex
required), icon (nullable), sortOrder. Seed 4 defaults per user: Study, Work,
Health, Personal.

TaskInstance (new): id, taskId (FK cascade delete), userId (denormalized),
date (DATE, local calendar date), status enum PENDING | COMPLETED | SKIPPED |
RESCHEDULED default PENDING (Phase 4 mutates it), overrideStartTime,
overrideEndTime, overrideNotes (all nullable). Unique (taskId, date); index
(userId, date).

One additive migration.

## 3. Recurrence

No RRULE engine. NONE = only startDate. DAILY = every day startDate..endDate.
WEEKLY = recurrenceDays non-empty. MONTHLY = recurrenceDayOfMonth (clamp to
last day of short months).

A pure helper occursOn(task, date): boolean in a shared location is the single
source of truth — today endpoint, calendar endpoint, and future AI scheduler
all call it. Must be exhaustively unit-tested (leap years, month boundaries,
endDate inclusivity, weekday arrays).

## 4. API (all under /api/v1, authenticated, every query scoped to
request.user.id; ownership violations return 404 not 403)

- POST /tasks — create. Validate: title required; times well-formed and
  startTime < endTime; recurrence fields consistent with recurrenceType;
  routineId/categoryId belong to user. 201 + task.
- GET /tasks — list templates. Filters: routineId, categoryId, priority,
  archived (default false), search; cursor pagination (limit <= 100, default 25).
- GET /tasks/:id — single task with category + routine summary.
- PATCH /tasks/:id — partial update, same validation. Changing recurrence
  deletes FUTURE PENDING instances only (history immutable).
- DELETE /tasks/:id — soft delete by default; ?hard=true real delete + cascade.
- POST /tasks/reorder — ordered array of task IDs (all owned by user),
  rewrite sortOrder in a transaction.
- GET /tasks/today?date=YYYY-MM-DD — KEY ENDPOINT, see §5.
- GET /tasks/calendar?from&to — occurrence dates per task over max 92 days,
  computed from occursOn, does NOT materialize instances.
- PATCH /task-instances/:id — per-day overrides (times, notes); status changes
  limited to PENDING/SKIPPED until Phase 4.
- Task category CRUD under /task-categories. Delete requires empty category or
  ?reassignTo=<id>.

Reuse the project-wide error envelope; 400s list per-field messages.
Rate limit: 100 req/min per user on this router (@fastify/rate-limit).

## 5. Instance Materialization (lazy, idempotent — NO cron)

GET /tasks/today: (1) load user's active tasks covering the date, (2) filter
with occursOn, (3) createMany missing TaskInstance rows with skipDuplicates
(the (taskId, date) unique constraint makes this idempotent under concurrency),
(4) return instances joined with templates, sorted by startTime then sortOrder.
Cache in Redis, key today:{userId}:{date}, TTL 60s, invalidated on any
task/instance mutation by that user.

## 6. Frontend

- /today — app home. Timeline of timed tasks + "Anytime" section for untimed,
  category color treatment. Checkbox toggles only PENDING/SKIPPED until
  Phase 4. Empty state prompts creation.
- /tasks — template management: filterable list, archive toggle,
  drag-to-reorder (optimistic, persists via /tasks/reorder).
- Task editor (modal/drawer, create + edit): title, notes, routine selector,
  category selector with inline create, priority control, color override,
  time range (REUSE existing TimePicker.tsx), duration fallback, recurrence UI
  (None/Daily/Weekly weekday chips/Monthly day-of-month), start/end date.
  Client validation mirrors server; server errors map to fields.
- Category manager in settings: rename, recolor, reorder, delete-with-reassign.
- Data layer: TanStack Query (add if absent), keys ['tasks',filters],
  ['today',date], ['categories']; precise invalidation; optimistic updates
  with rollback for reorder + instance status.

## 7. Free vs Premium hook

Enforce now: free limit 50 active tasks, 10 categories, checked server-side on
create, distinct error code LIMIT_REACHED. Limits read from a plan-config
module so the premium phase only changes config.

## 8. Acceptance criteria

Unit: occursOn exhaustive; validation; limits. Integration: CRUD happy paths;
cross-user access = 404; concurrent today-calls create no duplicate instances;
recurrence edit deletes only future pending; category reassign; rate limit
fires. Frontend: editor validation, today sections render, reorder persists.

## 9. Implementation order

1. Migration + enums + seed default categories
2. occursOn helper + unit tests (before any endpoint)
3. Category CRUD
4. Task CRUD + reorder + validation + plan limits
5. Materialization + /tasks/today + /tasks/calendar + Redis cache
6. Instance override endpoint
7. Frontend: data layer -> editor -> tasks page -> today view -> categories
8. Integration tests + manual QA
