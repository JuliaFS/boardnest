# Boardnest database

Boardnest uses a SQL-first PostgreSQL schema hosted by Supabase. Every table is defined in its own ordered migration. Cross-table functions, RLS policies, and grants are isolated in later migrations so dependencies remain explicit.

## Entity relationship map

```text
auth.users 1 ─── 1 profiles
                    │
                    ├── 1 notification_preferences
                    ├──< workspace_members >── workspaces
                    │                              │
                    │                              ├── 1 workspace_subscriptions >── subscription_plans
                    │                              ├──< invitations
                    │                              ├──< notifications
                    │                              ├──< notification_deliveries
                    │                              ├──< activity_logs
                    │                              └──< projects
                    │                                     │
                    └──< project_members >────────────────┤
                                                          ├──< task_statuses
                                                          ├──< labels
                                                          └──< tasks
                                                                 │
                                                                 ├──< task_assignees >── profiles
                                                                 ├──< task_labels >────── labels
                                                                 ├──< task_comments
                                                                 ├──< task_reminders
                                                                 │      └──< task_reminder_recipients >── profiles
                                                                 ├──< activity_logs
                                                                 └──< notifications
```

`workspace_id` is the tenant boundary. Private project access is granted through `project_members`, except that workspace owners and admins always retain access.

## Migration order

Run every file exactly once and in filename order:

| Migration                            | Responsibility                                              |
| ------------------------------------ | ----------------------------------------------------------- |
| `000_extensions.sql`                 | PostgreSQL extension and private schemas                    |
| `001_common_functions.sql`           | Shared `updated_at` trigger function                        |
| `010_profiles.sql`                   | Auth-linked profiles and signup trigger                     |
| `020_workspaces.sql`                 | Tenant records                                              |
| `030_workspace_members.sql`          | Workspace roles and owner invariants                        |
| `040_projects.sql`                   | Project visibility, status, and archival                    |
| `050_project_members.sql`            | Explicit private-project access                             |
| `060_task_statuses.sql`              | Configurable Kanban columns and defaults                    |
| `070_tasks.sql`                      | Tasks, priorities, ordering, and search index               |
| `080_task_assignees.sql`             | Multi-assignee relationship and access validation           |
| `090_labels.sql`                     | Project-scoped labels                                       |
| `100_task_labels.sql`                | Task-to-label relationship                                  |
| `110_task_comments.sql`              | Task discussion                                             |
| `120_activity_logs.sql`              | Append-only audit events                                    |
| `130_notifications.sql`              | Per-user notifications                                      |
| `140_invitations.sql`                | Hashed, expiring workspace invitations                      |
| `200_authorization_functions.sql`    | Non-exposed RLS helper functions                            |
| `210_rls_policies.sql`               | Per-operation RLS policies                                  |
| `220_api_grants.sql`                 | Explicit `anon`, `authenticated`, and `service_role` grants |
| `230_anonymous_guest_limits.sql`     | Concurrency-safe quotas for anonymous guest sessions        |
| `240_subscription_plans.sql`         | Guest, Free, and Pro notification capabilities              |
| `250_workspace_subscriptions.sql`    | Workspace plan assignment and billing-ready state           |
| `260_notification_preferences.sql`   | Per-user channel and event preferences                      |
| `270_task_reminders.sql`             | Reminder schedules, recipients, and plan enforcement        |
| `280_notification_deliveries.sql`    | Durable email outbox and monthly email quota enforcement    |
| `290_notification_authorization.sql` | Reminder and subscription RLS policies                      |
| `300_notification_grants.sql`        | Explicit grants for notification scheduling tables          |
| `310_reminder_api_functions.sql`     | Atomic reminder and recipient API transactions              |
| `320_in_app_reminder_scheduler.sql`  | Due-reminder processing, recurrence, and idempotency        |
| `330_account_deletion.sql`           | Ownership handoff and safe account anonymization            |

Do not run `database/tests/*.sql` as migrations. The smoke test inserts deterministic temporary records and rolls the transaction back.

## Anonymous guest quotas

Supabase anonymous users retain the authenticated database role and are
distinguished by the signed is_anonymous JWT claim. Insert triggers enforce a
maximum of one workspace, one project, twenty tasks, one invitation, and ten
comments per guest. Updates and task moves remain unlimited. Counts include
archived rows so archival cannot bypass storage limits; hard deletion releases
the corresponding quota. Per-user advisory transaction locks keep concurrent
inserts from exceeding a limit.

Guest workspaces receive the `guest` plan automatically. They may enable one
in-app reminder per task on at most three distinct tasks. Email reminders are
not available to guests. Pausing or deleting a reminder releases its active-task
quota; completing a task stops reminders configured with
`stop_when_completed` when the scheduler processes them.

## Notification plans and scheduling

Registered workspaces receive the `free` plan automatically. Plan limits are
stored in `subscription_plans`, while `workspace_subscriptions` records the
workspace's current plan and billing lifecycle. The database serializes quota
changes with advisory transaction locks so parallel requests cannot exceed the
active-task, per-task, recipient, or monthly-email limits.

`task_reminders.next_run_at` is stored as an absolute UTC instant. Its IANA
`timezone` preserves the user's local recurrence intent for weekly, monthly,
quarterly, yearly, and daylight-saving calculations. A custom date is
represented by `schedule_kind = 'once'` and its chosen `next_run_at`.

`notification_deliveries` is a durable server-managed email outbox. Its unique
idempotency key prevents one reminder occurrence from being queued twice. The
scheduler queues eligible email occurrences here; provider delivery is a
separate worker stage.

`process_due_task_reminders` is a service-role-only scheduler transaction. It
claims bounded batches with `FOR UPDATE SKIP LOCKED`, creates idempotent in-app
notifications, queues eligible email deliveries, and advances or completes the
schedule. Multiple API instances can run it without delivering the same
occurrence twice. Missed recurring runs advance to the next future occurrence
instead of flooding the recipient after downtime.

The GraphQL API creates a reminder and its first recipient set through
`create_task_reminder_with_recipients`. Recipient edits use
`replace_task_reminder_recipients`. Both narrowly granted functions verify the
authenticated JWT actor through the same private authorization helpers used by
RLS. Existing plan, quota, and recipient triggers still apply, while a failure
rolls the whole operation back.

## Project visibility and status

Visibility and status are independent:

- `visibility = workspace`: every workspace member can see the project.
- `visibility = private`: explicit project members can see it; workspace owner/admin always retain access.
- `status`: `planned`, `active`, `on_hold`, or `completed`.
- `archived_at`: removes a project from active views without overloading its business status.

A new project defaults to `workspace` visibility and `active` status. Its creator becomes `project_lead`, and the database creates Todo, In Progress, In Review, and Done task statuses automatically.

## Deletion behavior

- Account deletion first previews every owned workspace and requires an explicit decision for each sole-owned workspace.
- A sole owner transfers a shared workspace to an existing member. A one-member workspace is deleted only after explicit confirmation. Workspaces with another owner need no action.
- The service-role-only preparation transaction runs before Supabase Auth deletion. Shared projects remain, while nullable creator attribution is anonymized when the profile is removed.
- Deleting a workspace cascades through all tenant-owned data.
- Deleting a project cascades through its operational data.
- Deleting a task cascades through assignments, labels, and comments.
- Deleted comment authors and activity actors become `NULL` so historical content remains meaningful.
- Projects and tasks normally use `archived_at`; hard deletion is reserved for explicit destructive actions.
- A trigger prevents removal or demotion of the last workspace owner.

## Migration rules

- Migrations are immutable after they have been applied to a shared environment.
- A schema change receives a new numbered file; an applied file is never edited.
- Table migrations own their keys, checks, indexes, timestamps, comments, and delete behavior.
- RLS is enabled immediately in every table migration, before policies are added.
- Raw invitation tokens and passwords are never persisted.
- Development seed data stays separate from production migrations.

See [Database design](../docs/DATABASE.md) for table-level details and [Supabase setup](../docs/SUPABASE.md) for execution instructions.
