# Documentation audit

Reviewed against repository source on 2026-11-13. This is a source/configuration
consistency review, not certification of a deployed environment or a fresh
end-to-end test run. No runtime code, hosted data, migrations, or provider
settings were changed by this documentation update.

## Coverage and source of truth

| Area                            | Source checked                                                                                                                                                                                                                                                                                                     | Documented behavior                                                                                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser authentication          | [API routes](../apps/api/src/app.ts), [auth service](../apps/api/src/auth/auth-service.ts), [web auth](../apps/web/src/features/auth/AuthProvider.tsx)                                                                                                                                                             | Cookie-backed registration, PKCE confirmation, login, refresh, logout, guest admission, and account deletion. `/auth/me` remains an alias of `/auth/session`.                                                                    |
| Native authentication/lifecycle | [native transport](../apps/mobile/src/lib/apollo.ts), [lifecycle](../apps/mobile/src/lib/mobile-lifecycle.tsx), [secure storage](../apps/mobile/src/lib/secure-storage.ts)                                                                                                                                         | Native bearer sessions, secure storage, foreground/network recovery, query-only retries, and blocked offline mutations; no native guest login.                                                                                   |
| Authorization and schema        | [GraphQL schema](../apps/api/src/graphql/schema.ts), [data service](../apps/api/src/graphql/data-service.ts), [SQL policies](../database/migrations/210_rls_policies.sql)                                                                                                                                          | JWT-aware Supabase reads/writes, explicit workspace/project roles, protected mutations, paginated connections versus scoped arrays.                                                                                              |
| Invitation delivery/acceptance  | [email sender](../apps/api/src/invitations/invitation-email.ts), [migration 430](../database/migrations/430_in_app_workspace_invitations.sql)                                                                                                                                                                      | Email token is hashed in storage; in-app delivery targets an already-registered matching account and respects preferences. No historical/later-signup backfill. Acceptance checks the registered email and invitation lifecycle. |
| Invitation correction           | [migration 440](../database/migrations/440_change_invitation_email.sql), [web form](../apps/web/src/features/members/InviteMemberForm.tsx), [native section](../apps/mobile/src/features/workspaces/WorkspaceInvitationsSection.tsx)                                                                               | Registered managers change an unexpired pending email through an atomic revoke-and-replace operation. Role is preserved; a conflict preserves the original; a successful replacement invalidates its old link.                   |
| Tasks and board state           | [web board](../apps/web/src/features/projects/BoardPage.tsx), [board cache](../apps/web/src/features/tasks/board-cache.ts), [task form](../apps/web/src/features/tasks/TaskForm.tsx)                                                                                                                               | Mutation responses and task subscriptions update the same board cache without a full refetch on create/edit/move; grouped state handles optimistic movement and rollback.                                                        |
| Realtime distribution           | [Redis bus](../apps/api/src/realtime/redis-event-bus.ts), [guest limiter](../apps/api/src/auth/guest-admission.ts), [web transport](../apps/web/src/lib/apollo-client.ts)                                                                                                                                          | Two event-bus connections plus one guest-limiter connection. Task/comment/membership streams originate from GraphQL mutations; SQL notification triggers are separate.                                                           |
| Notification creation and plans | [event model](../database/migrations/360_notification_event_model.sql), [system producers](../database/migrations/390_system_notification_events.sql), [push extension](../database/migrations/420_push_notifications.sql)                                                                                         | Global/event/plan gates, durable in-app/outbox records, actor exclusion, and a dedicated pre-membership invitation exception.                                                                                                    |
| Scheduling and workers          | [reminder scheduler](../apps/api/src/reminders/reminder-scheduler.ts), [custom scheduler](../apps/api/src/notifications/custom-notification-scheduler.ts), [email worker](../apps/api/src/notifications/notification-delivery-worker.ts), [push worker](../apps/api/src/notifications/push-notification-worker.ts) | Separate reminder/custom timers, SMTP leases/retries, Expo tickets/receipts, and service-role-only worker RPCs. Flags default to disabled.                                                                                       |
| Inbox and safe routing          | [web notification routes](../apps/web/src/features/notifications/notification-schemas.ts), [native routes](../apps/mobile/src/features/notifications/notification-model.ts), [unread polling](../apps/web/src/features/core/AppLayout.tsx)                                                                         | Invitation IDs are validated; native never executes `payload.route`. Count polling is not inbox polling. Web inbox is available before joining a workspace.                                                                      |
| Settings                        | [web Settings](../apps/web/src/features/settings/SettingsPage.tsx), [account-deletion service](../apps/api/src/auth/account-deletion-service.ts)                                                                                                                                                                   | Ownership-impact preview, explicit transfer/deletion choices, and permanent account deletion; not an empty preferences placeholder.                                                                                              |
| Docker and runtime environment  | [Dockerfile](../Dockerfile), [Compose](../compose.yaml), [Nginx](../docker/nginx.conf), [API config](../apps/api/src/config/env.ts), [.env example](../.env.example)                                                                                                                                               | Host development versus container ports, build-time frontend values, runtime API values, external Supabase, Redis counters, and HTTP liveness checks.                                                                            |
| CI/CD and contracts             | [CI](../.github/workflows/ci.yml), [deployment](../.github/workflows/deploy.yml), [mobile E2E](../.github/workflows/mobile-e2e.yml), [code generation](../packages/graphql-types/codegen.ts)                                                                                                                       | Two main CI/CD workflows plus manual Android E2E. Generated-contract and mobile tests are part of Quality; application deployment does not apply SQL migrations.                                                                 |

## Corrections made

- Added migrations 430/440 and their full invitation lifecycle to the main
  feature, GraphQL, notification, mobile, security, and operational guides.
- Replaced automatic web reconnect recovery claims with the actual distinction:
  mobile refetches active queries; web reconnects the socket without a board
  refetch.
- Documented the shared board-cache update path and task-scoped mobile comment
  callbacks, removing obsolete full-board refetch descriptions.
- Updated Settings, native notification payload usage, subscription fields,
  push channels/status/device semantics, and the event catalog.
- Corrected missing environment variables, migration release prerequisites,
  workflow counts, generated-contract ownership, and integration-test boundaries.
- Distinguished database foundations and API-only features from shipped client
  controls instead of describing all tables as complete product workflows.

## Current limits that remain in the implementation

These are documented limits, not fixes included in this change:

- Web initially loads 100 board tasks and has no load-more control. Search and
  priority filters apply to the loaded task set; API search is a separate
  title-based full-text query.
- Web reconnect does not automatically reload missed state. Redis Pub/Sub has
  no event replay; refreshing/refetching remains necessary.
- Only the unread badge polls every 60 seconds. The inbox list is cache-first
  and can require a refresh/refetch to show new entries after a prior visit.
- Task-status and label tables have constraints/RLS, but no GraphQL CRUD or
  client configuration editor. Columns are seeded when a project is created.
- `activityFeed` reads existing rows, but the repository has no automatic
  activity-log producer. Notification event production is a different system.
- Dedicated task-reminder CRUD is API-only; client custom schedules can point
  to tasks but are a separate model. Web has no task assignment/comment editor;
  native does.
- Fractional task positions have no automatic rebalancing. Notification
  retention is plan metadata without a cleanup worker.
- Web business GraphQL documents are still handwritten separately from the
  generated native operation package.
- The current Compose API environment allowlist does not pass push-worker
  settings. Host/production API push requires its explicit runtime flags;
  Docker-based push testing needs an override.
- The API runtime copies `pnpm deploy --prod` output without a package-files
  allowlist; unlike the explicitly dist-only web image, exclusion of API source
  files is not guaranteed.
- `/health` checks HTTP liveness, not continuous Supabase, Redis, SMTP, or Expo
  readiness. Existing delivery-health metrics are not channel-specific and
  have no dedicated `sent`-awaiting-push-receipt counter.
- General auth/GraphQL rate limiting, weighted query-cost analysis, and an
  application CSP are not implemented. Guest-admission limits already exist;
  Turnstile's iframe policy is not an application CSP.

## Verification boundary

Documentation verification checks Markdown formatting, local link/file targets,
coverage of migration filenames, and documented runtime environment keys. The
API schema, SQL files, scripts, and workflow YAML remain the authoritative
contracts for exact signatures and execution order.

This review does not establish that all migrations are installed remotely,
that provider domains and credentials are configured, that email/push delivery
works on a real device, or that every test passes against a particular hosted
schema. SQL regression files require a disposable Supabase-compatible database;
`013_push_notifications.sql` additionally requires pgTAP. Device and live
provider behavior needs the manual checks in the relevant guides.
