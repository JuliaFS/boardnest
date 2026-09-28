# Public demo

Boardnest provides a no-registration guest demo backed by a real Supabase
anonymous session. Guests use the same GraphQL API, PostgreSQL Row Level
Security policies, and real-time task workflow as registered users.

## Guest flow

1. Open the sign-in page and choose **Continue as guest**.
2. The API creates a Supabase anonymous user and stores its access and refresh
   tokens in secure `HttpOnly` cookies.
3. The guest enters the protected application and can create a workspace,
   project, and tasks without providing personal information.
4. Signing out ends access to that guest identity. The session cannot be
   recovered from another browser or after its cookies are removed.

## Limits

Each guest may create:

| Resource    | Limit |
| ----------- | ----: |
| Workspaces  |     1 |
| Projects    |     1 |
| Tasks       |    20 |
| Invitations |     1 |
| Comments    |    10 |

Task edits, project edits, search, filtering, and task moves are unlimited.
Archived resources continue to count toward the quota so archival cannot be
used to accumulate data. Hard deletion releases the corresponding quota.

The invitation and comment capabilities currently exist at the GraphQL and
database layers. Their full product UI remains outside the current portfolio
scope, and the `/members` route is still a documented extension point.

## Enforcement

The UI explains the limits but is not the security boundary. Migration
`database/migrations/230_anonymous_guest_limits.sql` installs database triggers
that inspect the signed `is_anonymous` JWT claim before inserts.

Quota checks use a per-user PostgreSQL advisory transaction lock. Concurrent
requests from the same guest are therefore serialized, preventing parallel
inserts from exceeding a limit. Registered users are not subject to these demo
quotas.

Quota failures are returned through GraphQL as readable `BAD_USER_INPUT`
errors. Existing RLS policies continue to isolate each guest's workspace and
project data.

## Deployment setup

1. Apply all database migrations in filename order, including
   `230_anonymous_guest_limits.sql`.
2. In Supabase, enable **Authentication → Providers → Anonymous Sign-Ins**.
3. Keep the Supabase anonymous-sign-in IP rate limit enabled.
4. Confirm the frontend and API origins match the configured CORS and cookie
   settings.
5. Verify the flow from `/login` by selecting **Continue as guest**.

## Production considerations

- Supabase anonymous users are persistent Auth records and are not removed
  automatically. A production deployment should periodically delete abandoned
  guest data and anonymous users after a defined retention period.
- CAPTCHA/Turnstile is not wired into the current guest button. Add a widget
  and forward its token through `/auth/guest` before enabling CAPTCHA in
  Supabase.
- The current quota protects application rows but does not replace edge or
  provider-level rate limiting for guest-account creation.
- Invitation delivery and acceptance are not connected to an email provider.
- A guest account cannot currently be upgraded in place to a permanent
  Boardnest account.

## Verification

The API test suite covers guest-session creation, cookie issuance, and token
non-disclosure. TypeScript, lint, unit/component tests, production builds, and
the Playwright browser workflow pass with the guest mode enabled.

Database quota triggers require an isolated Supabase-compatible PostgreSQL
environment for runtime verification. Never run the transactional database
smoke test against the hosted production project.
