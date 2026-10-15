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
The project membership component and GraphQL resolver tests verify roster
loading, role validation, and adding an existing workspace member to a project.
The notification event model smoke test verifies idempotent in-app and outbox
creation, per-event email opt-out, email-only delivery, and the Guest plan email
restriction. GraphQL tests cover catalog, effective plan capability, preference
queries, preference upsert mapping, and malformed event-type rejection.
The delivery worker smoke test verifies claim leases, retry backoff, stale-token
protection, successful completion, and immutable attempt history. Unit tests
cover SMTP rendering, error classification, missing email handling, overlapping
runs, and transport shutdown.
The custom schedule smoke test verifies hierarchical context, owner-only RLS,
the Free plan's minimum interval and ten-active-schedule quota, and quota
release after pausing. GraphQL resolver tests cover normalized creation,
contextual reads, lifecycle mutations, deletion, and invalid shape rejection.
Frontend tests cover schedule form validation, actionable plan-limit messages,
the accessible creation modal, personal-recipient disclosure, and plan usage.
The API resolver suite also verifies that delivery history always derives its
recipient from the authenticated session.
The system event smoke test verifies workspace and project membership, task
creation, assignment, detail and status changes, comments, reminders, actor
exclusion, reminder event-specific opt-out, and workspace-removal privacy
cleanup.

## Covered critical behavior

- login, protected routing, cookie-backed API sessions, refresh, logout, and
  PKCE callback behavior;
- creation of workspaces, private projects, and tasks;
- project/task validation and task editing;
- task movement and optimistic ordering behavior;
- task assignment resolver inputs and authenticated actor identity;
- unauthenticated access denial and SQL RLS smoke checks;
- GraphQL WebSocket delivery and Redis Pub/Sub validation/distribution.
- project roster queries, role validation, and member management controls;
- notification plan assignment and database-enforced guest reminder limits.
- GraphQL reminder creation, lifecycle actions, recipients, preferences, and
  workspace capability queries.
- canonical notification event metadata, plan gates, per-event preferences,
  and idempotent in-app/email fan-out.
- atomic system-event production for memberships, tasks, assignments, comments,
  and reminder occurrences, including actor and recipient rules.
- email outbox claim leases, SMTP delivery, retry classification and backoff,
  terminal failures, and per-attempt history.
- custom notification schedule CRUD, context authorization, channel gates, and
  plan-specific count and interval limits.
- concurrency-safe reminder scheduling and local-time recurrence.
- account-deletion ownership transfer, explicit personal-workspace deletion,
  creator anonymization, and cookie cleanup.
