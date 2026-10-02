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

Continue through `300_notification_grants.sql` in filename order. Do not run
files under `database/tests` against the hosted project; they are intended only
for an isolated disposable database.

## 3. Verify the result

In Table Editor, confirm that these 20 public tables exist:

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
- `task_reminders`
- `task_reminder_recipients`
- `notification_deliveries`

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
- Server secret/service-role key, reserved for future privileged tooling
- PostgreSQL connection string, reserved for CLI administration

Boardnest uses the current `sb_publishable_...` key format on the API server. The browser does not receive a Supabase client or key. The deployed application needs only `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`. Use a server-only secret key only for future privileged backend operations.

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

Deleting an Auth user can fail while that user is recorded as a workspace creator or the final owner. Transfer ownership and remove/reassign protected references before account deletion.

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
