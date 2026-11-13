# Testing

## Test layers

The web/API workflow uses three complementary test layers:

- Vitest unit tests cover validation, task ordering and grouping, environment
  parsing, cookie behavior, and Redis event serialization.
- React Testing Library component tests exercise workspace, project, and task
  forms through their accessible controls and Apollo operations.
- Playwright browser tests cover authentication routing and the complete
  workspace → private project → task → edit → cross-column move workflow.

The mobile application adds four native-focused layers:

- Vitest covers pure validation, safe route mapping, plan limits, notification
  helpers, task ordering and rollback snapshots, and date/timezone rules;
- Jest with the Expo preset and React Native Testing Library covers accessible
  login, workspace/project/task forms, standard query states, notification
  inbox behavior, and typed Apollo mutations;
- integration tests restore and refresh Supabase sessions, clear private Apollo
  cache on logout, exercise mocked GraphQL success/error responses, and verify
  realtime reconnect gates;
- Maestro drives an installed Android APK through authentication, core entity
  creation, task status movement, notification reading, logout, registration,
  and disposable-account deletion flows.

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

Run only the mobile suites:

```bash
pnpm --filter @boardnest/mobile test:unit
pnpm --filter @boardnest/mobile test:components
pnpm --filter @boardnest/mobile test:components:coverage
```

React Native component tests use the `.native-test.tsx` suffix so they are
executed by Jest and excluded from the Vitest unit pattern. The root
`pnpm test:ci` command runs both mobile test layers in the CI Quality job.

Device-level Maestro tests require an installed APK and dedicated test data.
They run through the manually dispatched **Mobile E2E** GitHub Actions workflow
because every build URL and backend target is explicit. See
[`.maestro/README.md`](../.maestro/README.md) for secrets, test-data safety, and local commands.

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
documented in [Supabase setup](SUPABASE.md); they are destructive and must not be executed
against the hosted project. The notification model smoke test also verifies
automatic plan assignment, preference creation, the three-task guest reminder
limit, quota release after pausing, rejection of guest email reminders,
recipient-only unread visibility, and rejection of cross-recipient read
updates.
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
The mobile task model tests verify column ordering, immutable optimistic moves,
rollback snapshots, due-date parsing, and task editing permissions. API workflow
tests verify task assignee/comment reads and composite assignment removal.
Mobile realtime tests verify background retry gating, foreground recovery,
bounded duplicate suppression, stable task event identities, and immutable
subscription-driven board updates. API event-bus and workflow tests verify
scoped comment and membership publication across in-memory and Redis transports.
Mobile notification model tests verify structured native route construction,
invalid identifier rejection, unread badge boundaries, delivery channel
validation, and workspace-plan interval enforcement. Shared contract tests
verify that notification documents remain generated from the API schema.
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
Notification inbox tests cover keyboard activation, unread mutation and
navigation, already-read behavior, untrusted-route rejection, structured route
fallbacks, optimistic unread-count updates, rollback recovery, and accessible
badge boundaries. API tests verify that unread counts and read mutations are
scoped to the authenticated recipient and reject unauthenticated access.
The system event smoke test verifies workspace and project membership, task
creation, assignment, detail and status changes, comments, reminders, actor
exclusion, reminder event-specific opt-out, and workspace-removal privacy
cleanup.
The notification hardening smoke test verifies queued-delivery cancellation on
global and event-specific unsubscribe, duplicate producer idempotency, distinct
leases across competing claims, quota boundaries, retry exhaustion, stale-token
protection, and aggregate production metrics. Worker unit tests additionally
verify deterministic retry `Message-ID` values and that one permanent SMTP
failure does not abort the remaining claimed batch.
The custom scheduler smoke test verifies one-time completion, channel masking,
stable occurrence replay, month-end anchoring, DST-safe local recurrence, and
missed-interval recovery. Scheduler unit tests cover bounded RPC calls,
same-process overlapping-run coalescing, parallel API instances, recovery after
a failed poll, and shutdown.

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
- concurrency-safe custom notification scheduling, stable replay, calendar
  anchoring, and missed-occurrence recovery.
- account-deletion ownership transfer, explicit personal-workspace deletion,
  creator anonymization, and cookie cleanup.
- queued-email unsubscribe enforcement, duplicate-delivery protection, quota
  boundaries, SMTP failure isolation, and service-role production metrics.

## Invitation and cache regression checks

- `014_in_app_workspace_invitations.sql` checks recipient-only notification
  visibility before membership, preference opt-out, no duplicate email/push,
  ID acceptance, token compatibility, revocation, expiry, and private grants.
- `015_change_invitation_email.sql` checks registered-admin authorization,
  same-email rejection, duplicate-address rollback, role preservation, old-link
  invalidation, replacement notification creation, and new-token acceptance.
- Web tests cover the prefilled Change email dialog, cancellation, normalized
  submission, conflict feedback, and invitation-ID acceptance without an email
  token. Native component tests cover the equivalent edit sheet and acceptance.
- Board cache tests cover mutation/subscription upserts without duplicate cards,
  movement/edit preservation, deletion, and an initially absent cached board.
- Mobile realtime tests check that comment events for another task do not invoke
  the open task's refresh callback.

The SQL suites are not run by `pnpm test`, `pnpm check`, or CI. Files 001–012 and
014–015 use transactional assertions; `013_push_notifications.sql` additionally
requires pgTAP (`plan`, schema assertions, and `finish`). Use a disposable
Supabase-compatible database with the expected Auth schema, roles, JWT helper
functions, and grants. A plain PostgreSQL database with partial Auth stubs is not
an equivalent environment. Do not interpret a source-level documentation audit
or a test's presence as proof that all SQL suites pass on the hosted schema.
