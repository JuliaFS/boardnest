# Testing

## Test layers

Boardnest uses three complementary test layers:

- Vitest unit tests cover validation, task ordering and grouping, environment
  parsing, cookie behavior, and Redis event serialization.
- React Testing Library component tests exercise workspace, project, and task
  forms through their accessible controls and Apollo operations.
- Playwright browser tests cover authentication routing and the complete
  workspace → private project → task → edit → cross-column move workflow.

The browser suite uses a stateful network fixture. It runs the real React
application in Chromium while replacing external Supabase/API dependencies
with deterministic HTTP and GraphQL responses. API tests independently run the
real Express, GraphQL HTTP, and GraphQL WebSocket transports. This division
keeps local and CI runs repeatable without changing hosted Supabase data.

## Commands

Install the pinned browser once after `pnpm install`:

```bash
pnpm exec playwright install chromium
```

Run the suites:

```bash
pnpm test
pnpm test:coverage
pnpm test:e2e
pnpm test:e2e:ui
pnpm check
```

`pnpm check` includes unit/component tests, builds, and the Chromium E2E suite.
Playwright starts an isolated Vite server on `127.0.0.1:4173`.

Coverage reports are written below each tested application and are ignored by
Git. The thresholds intentionally establish a realistic baseline and make
future coverage regressions fail:

| Application | Statements | Branches | Functions | Lines |
| ----------- | ---------- | -------- | --------- | ----- |
| API         | 65%        | 50%      | 60%       | 65%   |
| Web         | 55%        | 45%      | 40%       | 55%   |

## External integration checks

The Redis integration test is opt-in because it requires a reachable Redis
instance:

```bash
pnpm redis:up
REDIS_INTEGRATION_URL=redis://127.0.0.1:6379 \
  pnpm --filter @boardnest/api test
```

Database RLS and trigger behavior is verified by the SQL files under
`database/tests`. Run them only against an isolated, disposable database as
documented in `docs/SUPABASE.md`; they are destructive and must not be executed
against the hosted project. The notification model smoke test also verifies
automatic plan assignment, preference creation, the three-task guest reminder
limit, quota release after pausing, and rejection of guest email reminders.
The reminder API function smoke test verifies atomic reminder creation and
rollback when recipient replacement violates task-recipient constraints.
The scheduler smoke test verifies one-time completion, recurrence across a DST
boundary, in-app generation, email outbox queuing, and occurrence idempotency.
The account-deletion smoke test verifies required ownership decisions, personal
workspace cascade deletion, shared-workspace transfer, membership cleanup, and
creator anonymization while preserving shared projects.
The invitation acceptance smoke test verifies atomic membership creation,
email ownership matching, lifecycle finalization, and idempotent reuse by the
same authenticated recipient.

## Covered critical behavior

- login, protected routing, cookie-backed API sessions, refresh, logout, and
  PKCE callback behavior;
- creation of workspaces, private projects, and tasks;
- project/task validation and task editing;
- task movement and optimistic ordering behavior;
- task assignment resolver inputs and authenticated actor identity;
- unauthenticated access denial and SQL RLS smoke checks;
- GraphQL WebSocket delivery and Redis Pub/Sub validation/distribution.
- notification plan assignment and database-enforced guest reminder limits.
- GraphQL reminder creation, lifecycle actions, recipients, preferences, and
  workspace capability queries.
- concurrency-safe reminder scheduling and local-time recurrence.
- account-deletion ownership transfer, explicit personal-workspace deletion,
  creator anonymization, and cookie cleanup.
