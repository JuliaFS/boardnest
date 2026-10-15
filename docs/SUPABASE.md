# Supabase setup

## 1. Create the project

1. Sign in to the Supabase Dashboard.
2. Create a new project and choose a region near the expected users and Railway backend.
3. Generate and store a strong database password in a password manager.
4. Wait until database provisioning completes.

Do not create Boardnest tables through Table Editor. The SQL files in this repository are the schema source of truth.

Enable **Authentication → Providers → Anonymous Sign-Ins** for the guest demo.
Under **Authentication → Bot and Abuse Protection**, select Cloudflare
Turnstile, enter the widget secret key, and enable CAPTCHA protection. The
frontend sends the widget token through the API and Supabase validates it during
anonymous sign-in. Keep the anonymous-sign-in provider limit enabled as an
additional boundary. Supabase does not automatically remove abandoned anonymous
users, so add a scheduled retention cleanup appropriate for the deployment.

## 2. Apply the migrations manually

For the current reviewed workflow:

1. Open **SQL Editor** in the Supabase Dashboard.
2. Open the first file under `database/migrations` locally.
3. Copy the entire file into a new SQL Editor query.
4. Run it once and confirm that the query reports success.
5. Continue with the next filename in lexical order.
6. Stop immediately if any file reports an error; do not continue with later files.

The complete order is listed in [database/README.md](../database/README.md). Each file owns a transaction, so a failure rolls that file back.

After applying `230_anonymous_guest_limits.sql`, verify its workspace quota
trigger explicitly:

```sql
select tgname
from pg_trigger
where tgname = 'workspaces_enforce_anonymous_quota'
  and not tgisinternal;
```

The query must return one row named `workspaces_enforce_anonymous_quota`. A
successful query with no returned rows means the migration is not installed.
The migration affects future inserts and does not remove guest resources that
were created before it was applied.

Continue through `400_notification_hardening.sql` in filename order. The scheduler
migration adds columns, an index, and narrowly granted functions; the account
deletion migration makes creator attribution nullable and adds narrowly granted
preview/preparation functions. The member cleanup migration installs a trigger
but does not remove existing memberships. Applying these migrations does not
delete an account or member. Do not run files under `database/tests` against the
hosted project; they are intended only for an isolated disposable database.
The invitation acceptance migration grants only its email-matched atomic
function to authenticated users and does not accept or modify existing pending
invitations when installed.
The notification event migration adds three non-destructive catalog and
preference tables, extends `notifications` with actor and idempotency context,
and installs a service-role-only producer plus an email-outbox trigger.
The delivery worker migration adds a non-destructive attempt-history table, a
lease token column, and three service-role-only claim/result functions.
The custom schedule migration adds one table, two plan capability columns,
private validation helpers, RLS policies, and authenticated CRUD grants. It
does not create notification occurrences or send messages when installed.
The system event migration adds private trigger producers only. It does not
backfill historical activity or send mail when installed; eligible future
membership, task, assignment, and comment writes create canonical notification
and email-outbox rows according to the recipient's plan and preferences.
The notification hardening migration adds a processing-lease index, queued
delivery cancellation on email opt-out, claim-time preference and plan
revalidation, and service-role-only aggregate health metrics. It does not send
or delete email. Pending deliveries that are no longer eligible become
`canceled`; in-flight SMTP messages cannot be recalled.

Verify the system-event installation:

```sql
select tgname
from pg_trigger
where not tgisinternal
  and tgname in (
    'workspace_members_notify_added',
    'workspace_members_notify_removed',
    'project_members_notify_added',
    'project_members_notify_removed',
    'tasks_notify_created',
    'tasks_notify_updated',
    'task_assignees_notify_added',
    'task_comments_notify_created',
    'notifications_00_filter_reminder_channel',
    'notification_deliveries_00_filter_reminder_channel'
  )
order by tgname;
```

The query must return all ten trigger names.

## 3. Verify the result

In Table Editor, confirm that these 25 public tables exist:

- `profiles`
- `workspaces`
- `workspace_members`
- `projects`
- `project_members`
- `task_statuses`
- `tasks`
- `task_assignees`
- `labels`
- `task_labels`
- `task_comments`
- `activity_logs`
- `notifications`
- `invitations`
- `subscription_plans`
- `workspace_subscriptions`
- `notification_preferences`
- `notification_event_types`
- `plan_notification_events`
- `notification_event_preferences`
- `task_reminders`
- `task_reminder_recipients`
- `notification_deliveries`
- `notification_delivery_attempts`
- `scheduled_notifications`

Open the RLS settings for every table and confirm RLS is enabled. The migrations enable it automatically; the Dashboard check is verification only.

Create a temporary user through Supabase Authentication and verify that a
matching `profiles` row appears. A failure in the profile trigger can block
signup, so perform this check before testing application authentication.
The same user must also receive a `notification_preferences` row. Creating a
workspace must create exactly one `workspace_subscriptions` row with `free` for
a registered user or `guest` for an anonymous user.

## 4. Project configuration values

The Dashboard project settings provide:

- Project URL → backend `SUPABASE_URL`
- Public publishable key → backend `SUPABASE_PUBLISHABLE_KEY`
- Server secret/service-role key → background-worker and account-deletion Railway secret
- PostgreSQL connection string, reserved for CLI administration

Boardnest uses the current `sb_publishable_...` key format on the API server.
The browser does not receive a Supabase client or key. Normal request handling
needs `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`; the account-deletion flow
and enabled background scheduler also need the service-role key for their
narrowly granted RPCs.

## 5. Secret boundaries

`VITE_*` values are compiled into the browser bundle and are public. RLS must protect every operation made with the public key.

Never expose any of these in frontend code, screenshots, logs, or Git:

- Supabase service-role/secret key
- Database password
- Direct database connection string
- Invitation raw tokens

The service role bypasses RLS. It belongs only in Railway/backend secrets and local server-only `.env` files.

## 6. Authentication relationship

Supabase Auth owns users, credentials, sessions, and password recovery. Boardnest references only `auth.users.id` from `public.profiles.id`. An `auth.users` insert trigger creates the profile using signup metadata or a safe fallback display name.

Boardnest performs account deletion through the authenticated Settings flow.
The backend previews ownership impact, transfers sole ownership or deletes only
explicitly confirmed personal workspaces, and then removes the Auth user. Do
not delete owners directly from the Supabase Auth table because that bypasses
these ownership decisions.

## 7. Migration automation boundary

The initial schema was applied manually before the hosted project had Supabase
CLI migration history. CI therefore never connects to or mutates the
hosted database: replaying the historical files could duplicate objects that
already exist.

Before automated production migrations are enabled, baseline the remote schema
with `supabase db pull`, carefully compare the generated timestamped baseline
against the reviewed files in `database/migrations`, and confirm that it is
recorded as applied remotely. Do this only after a backup; it is deliberately
separate from application deployment. After that transition, validate new
migrations in an isolated database and apply them through a controlled
deployment step. Do not make ad hoc production schema changes through Table
Editor or SQL Editor. See [Production deployment](DEPLOYMENT.md) for the exact
boundary.
