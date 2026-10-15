# Database design

## Design principles

- PostgreSQL is the source of truth; Redis will only distribute ephemeral events.
- `workspace_id` defines tenant ownership.
- Foreign keys and checks enforce invariants before application code runs.
- UUID primary keys avoid coordination between API instances.
- Mutable entities have database-managed `created_at` and `updated_at` timestamps.
- Soft archival is used for normal project/task lifecycle; hard deletion remains explicit.
- RLS is defense in depth. The GraphQL API still performs authentication and authorization.

## Permission matrix

Project roles never elevate a workspace role. A workspace `viewer` remains read-only even if accidentally added as a project `member`.

| Action                             | Owner | Admin              | Member / project lead | Member / project member | Viewer              |
| ---------------------------------- | ----- | ------------------ | --------------------- | ----------------------- | ------------------- |
| View workspace-visible project     | Yes   | Yes                | Yes                   | Yes                     | Yes                 |
| View private project               | Yes   | Yes                | If explicitly added   | If explicitly added     | If explicitly added |
| Create project                     | Yes   | Yes                | Yes                   | Yes                     | No                  |
| Change project status/metadata     | Yes   | Yes                | Yes                   | No                      | No                  |
| Change project visibility          | Yes   | Yes                | No                    | No                      | No                  |
| Hard-delete project                | Yes   | Yes                | No                    | No                      | No                  |
| Manage project members             | Yes   | Yes                | Yes                   | No                      | No                  |
| Create/edit tasks                  | Yes   | Yes                | Yes                   | Yes                     | No                  |
| Comment on accessible tasks        | Yes   | Yes                | Yes                   | Yes                     | Yes                 |
| Create reminders on editable tasks | Yes   | Yes                | Yes                   | Yes                     | No                  |
| Manage workspace membership        | Yes   | Yes, except owners | No                    | No                      | No                  |
| Delete workspace                   | Yes   | No                 | No                    | No                      | No                  |

For a workspace-visible project, a workspace member can work on tasks without an explicit `project_members` row. An explicit project `viewer` role narrows that user's task editing rights.

## Tables

### `profiles`

**Purpose:** Application-visible identity linked one-to-one to Supabase `auth.users`.

**Important columns:** `id`, `display_name`, `avatar_url`, `timezone`.

**Relationships:** `id` references only the primary key of `auth.users` with `ON DELETE CASCADE`. A signup trigger creates the profile. No password or credential data is stored.

**Security:** A user can update only their own permitted profile fields. Profiles are visible only to the owner or users sharing a workspace.

### `workspaces`

**Purpose:** Top-level multi-tenant boundary.

**Important columns:** `name`, globally unique `slug`, `created_by`, `archived_at`.

**Relationships:** Owns memberships, projects, invitations, notifications, and logs. Tenant-owned records cascade when the workspace is hard-deleted.

**Indexes:** Case-insensitive unique slug, creator lookup, and active-workspace lookup.

**Security:** Members can read; owner/admin can update; only owner can hard-delete.

### `workspace_members`

**Purpose:** Tenant membership and primary RBAC source.

**Important columns:** Composite key `(workspace_id, user_id)` and role `owner`, `admin`, `member`, or `viewer`.

**Relationships:** References workspaces and profiles with cascades. A workspace insert automatically creates its owner membership.

**Indexes:** Reverse user-to-workspace lookup and role lookup.

**Security:** Members can inspect their workspace roster. Owner/admin manage membership, but admins cannot create, remove, or demote owners. The final owner cannot leave or be demoted. Removing a member also clears their workspace-scoped project membership, task assignments, reminder participation, deliveries, and private notifications.

### `projects`

**Purpose:** Project container within one workspace.

**Important columns:** `visibility`, `status`, dates, and `archived_at`.

**Relationships:** Owns project members, task statuses, tasks, and labels. The creator is automatically added as `project_lead`.

**Indexes:** Unique active project name per workspace and active status listing.

**Security:** Workspace projects are visible to all workspace members. Private projects require explicit membership except for workspace owner/admin. Only owner/admin may change visibility; owner/admin/project lead may change status.

### `project_members`

**Purpose:** Explicit project role, required for ordinary access to private projects.

**Important columns:** Composite key `(project_id, user_id)` and role `project_lead`, `member`, or `viewer`.

**Relationships:** Composite foreign keys prove that the project and user belong to the same workspace.

**Security:** Project managers administer membership. A project role cannot elevate a workspace viewer to contributor rights.

### `task_statuses`

**Purpose:** Configurable Kanban columns per project.

**Important columns:** `name`, stable analytics `category`, display `color`, and integer `position`.

**Relationships:** A new project receives Todo, In Progress, In Review, and Done rows. Tasks reference both status and project, preventing cross-project status assignment.

**Indexes:** Unique case-insensitive name and position per project.

**Security:** Accessible project users can read; project managers configure columns.

### `tasks`

**Purpose:** Work item positioned in one Kanban status.

**Important columns:** `status_id`, `title`, `description`, `priority`, fractional `position`, `due_at`, and `archived_at`.

**Relationships:** Belongs to a project and status; owns assignees, labels, and comments.

**Indexes:** Board ordering, priority, due date, creator, and full-text title/description search.

**Security:** Accessible users can read. Contributors can create, edit, move, archive, and delete tasks; viewers cannot.

### `task_assignees`

**Purpose:** Many-to-many assignment between tasks and users.

**Relationships:** Assignee must be a workspace member and must have access if the project is private. A validation trigger protects this even for trusted writes.

**Security:** Project contributors manage assignments; accessible users can read them.

### `labels`

**Purpose:** Reusable project-scoped task labels.

**Important columns:** Case-insensitively unique `name` and validated hexadecimal `color`.

**Security:** Accessible users read; contributors manage.

### `task_labels`

**Purpose:** Many-to-many task-to-label relationship.

**Relationships:** Composite foreign keys ensure the task and label belong to the same project.

**Security:** Accessible users read; contributors attach and detach labels.

### `task_comments`

**Purpose:** Discussion attached to tasks.

**Important columns:** `body`, optional `author_id`, `edited_at`.

**Relationships:** Comments cascade with tasks. Author becomes `NULL` if the profile disappears.

**Security:** Every user who can view the task may comment. Authors and project managers can edit/delete comments.

### `activity_logs`

**Purpose:** Append-only audit history.

**Important columns:** tenant/project/task scope, actor, dotted `event_type`, entity identifiers, and JSON snapshot `metadata`.

**Relationships:** Workspace deletion removes its audit data. Project/task/actor deletion nulls optional references while snapshot metadata remains.

**Security:** Authenticated clients have read-only access filtered by workspace/project visibility. Only the trusted API writes events.

### `notifications`

**Purpose:** Private user notifications.

**Important columns:** recipient, optional actor, context references, canonical type, stable event key, content, JSON payload, and `read_at`.

**Indexes:** Recipient timeline, partial unread index, and a partial unique recipient/event-key index for retry safety.

**Security:** Recipients can read, mark read, and delete. Only the trusted API creates notifications.

### `notification_event_types`

**Purpose:** Canonical, data-driven catalog of supported notification events and channel defaults.

**Important columns:** dotted event code, category, display metadata, in-app and email defaults, and active state.

**Security:** Authenticated users can read active catalog entries. Only trusted server operations can manage the catalog.

### `plan_notification_events`

**Purpose:** Define the maximum in-app and email capabilities for every plan/event pair.

**Relationships:** References `subscription_plans` and `notification_event_types`; both references cascade when server-managed catalog data changes.

**Security:** Authenticated users can read capabilities. Only trusted server operations can change them.

### `subscription_plans`

**Purpose:** Data-driven Guest, Free, and Pro notification capabilities.

**Important columns:** Active reminder-task limit, reminders per task, recipients per reminder, active custom-schedule limit, minimum custom interval, monthly email quota, email entitlement, and history retention days.

**Security:** Authenticated users may read public plan capabilities. Only trusted server operations may change them.

### `workspace_subscriptions`

**Purpose:** Assign one effective plan and billing lifecycle to a workspace.

**Important columns:** `plan_code`, `status`, provider identifiers, billing period, and cancellation flag.

**Relationships:** A workspace receives `guest` when its creator is an anonymous Supabase user and `free` otherwise. The trigger also backfills existing workspaces when the migration is applied.

**Security:** Workspace members may read the subscription. Only the trusted server may change it. A canceled or past-due paid subscription receives Free capabilities; Guest remains Guest.

### `notification_preferences`

**Purpose:** Store each user's global channel and notification-event choices.

**Important columns:** In-app, email, task-created, task-assigned, and reminder toggles.

**Relationships:** Created automatically with a profile and removed with it.

**Security:** Users may read and update only their own preferences. A preference cannot override a plan restriction.

### `notification_event_preferences`

**Purpose:** Store optional per-event channel overrides without adding a new column for every event type.

**Important columns:** user, event type, in-app choice, and email choice. A missing row inherits the catalog defaults.

**Security:** Users can read, insert, update, and delete only their own rows. Effective channels are still capped by global preferences and workspace-plan entitlements.

### `task_reminders`

**Purpose:** Persist one-time, weekly, monthly, quarterly, or yearly task schedules.

**Important columns:** Task/workspace context, creator, IANA timezone, `next_run_at`, optional end, channels, completion behavior, and lifecycle status.

**Relationships:** Context is derived from the task by a protected trigger. Recipients are normalized through `task_reminder_recipients` and must be the task creator or an assignee.

**Indexes:** Due active reminders, active reminder tasks per workspace, task history, and creator history.

**Security:** Contributors create reminders. Reminder creators, recipients, and task managers can view them; creators and task managers can change them. Database locks enforce all plan limits under concurrent writes.

Guest workspaces may have active reminders on at most three distinct guest-created tasks, one reminder per task and one recipient per reminder. Guest email is rejected by PostgreSQL even if a client bypasses the UI.

The service-role-only scheduler claims due rows with `FOR UPDATE SKIP LOCKED`.
It preserves local recurring times across daylight-saving changes, completes
one-time schedules, skips stale missed occurrences, and stops configured
reminders for archived or completed tasks.

### `scheduled_notifications`

**Purpose:** Store personal one-time and custom-interval notification schedules independently of task reminder recipients.

**Important columns:** Owner, workspace with optional project/task context, title and body, schedule kind, interval value/unit, IANA timezone, next/end/last occurrence timestamps, channels, and lifecycle status.

**Relationships:** Workspace context is required. Project and task composite foreign keys prevent cross-workspace or cross-project context. Deleting the selected context or owner removes the schedule.

**Indexes:** Due active queue, owner/workspace history, and optional project/task context.

**Security:** Only the owner can read or mutate a schedule, and the owner must retain access to its workspace and optional private context. A protected trigger validates context, timezone, effective channel preferences, plan quota, and minimum interval on every insert, update, and resume.

Guest, Free, and Pro allow respectively 3, 10, and 100 active custom schedules per user/workspace. Their minimum recurring intervals are one day, one hour, and five minutes. The table is an API model only in this stage; a later scheduler will produce `custom.notification` occurrences.

### Reminder-generated `notifications`

Each generated in-app row records `reminder_id` and `scheduled_for`. Their
partial unique index makes one reminder occurrence idempotent per recipient,
including when several API instances poll concurrently.

### `notification_deliveries`

**Purpose:** Durable email outbox for scheduled reminders and canonical notification events.

**Important columns:** Recipient, schedule time, retry state, lease token, provider result, unique idempotency key, and JSON payload.

**Indexes:** Pending retry queue, workspace history, recipient history, and unique idempotency.

**Security:** Recipients have read-only access to their delivery history. Only trusted workers create or mutate deliveries. Inserts validate workspace membership, selected reminder recipients, plan email entitlement, and the monthly email quota.

The worker claims due rows with `FOR UPDATE SKIP LOCKED`. Completion and
failure RPCs require the exact claim token, so an expired worker cannot mutate a
newer attempt. Stale processing leases become claimable after five minutes.
Transient failures use bounded exponential backoff; permanent failures consume
the remaining attempt budget.

### `notification_delivery_attempts`

**Purpose:** Immutable operational history for completed SMTP attempts.

**Important columns:** Delivery, attempt number, provider, outcome, provider message ID or sanitized error, and start/finish timestamps.

**Security:** Recipients may read attempts belonging to their own delivery rows. Only service-role worker RPCs append history.

`public.create_notification_event` is the service-role-only producer boundary.
It validates tenant context, resolves preferences and plan entitlements, creates
an idempotent in-app row when enabled, and queues entitled email work. See
[Notifications](NOTIFICATIONS.md).

Private trigger producers invoke this boundary for workspace/project membership,
task creation and meaningful updates, task status changes and assignment, and
comment creation. `private.task_notification_recipients` limits broadcasts to
current project/task participants who still have project access. Actor exclusion
prevents self-notification loops, while task position-only writes are ignored.

### `invitations`

**Purpose:** Invite an email address before or after account creation.

**Important columns:** normalized email, intended workspace role, lifecycle status, SHA-256 `token_hash`, expiry, acceptance, and revocation timestamps.

**Indexes:** Unique token hash, one pending invitation per workspace/email, status list, and pending expiry cleanup.

**Security:** Owner/admin manage invitations. The token hash is excluded from authenticated column grants. Acceptance is a trusted API transaction that validates the raw token, adds membership, and changes status atomically.

## Task ordering

`tasks.position` is `numeric(20,10)`. Moving between two tasks uses a midpoint; moving to an edge uses a value before or after the current boundary. When positions become too dense, the API can rebalance one status column in a transaction. This avoids rewriting every task for normal drag-and-drop operations.

## RLS architecture

Security-definer helpers are in the non-exposed `private` schema with an empty `search_path` and fully qualified relation names. They avoid recursive membership policies and centralize the role combination rules. Public access is revoked, and only the minimum helper execution rights are granted to `authenticated`.

Every public table enables RLS in its own creation migration. Policies are operation-specific, and grants restrict mutable columns so clients cannot reassign tenant IDs, creators, authors, or recipients.
