# Public demo

Boardnest provides a no-registration guest demo backed by a real Supabase
anonymous session. Guests use the same GraphQL API, PostgreSQL Row Level
Security policies, and real-time task workflow as registered users.

## Guest flow

1. Open the sign-in page and complete the Cloudflare Turnstile check.
2. Choose **Continue as guest**. Redis applies the IP and global admission
   limits, then Supabase validates the single-use Turnstile token.
3. The API creates a Supabase anonymous user and stores its access and refresh
   tokens in secure `HttpOnly` cookies.
4. The guest enters the protected application and can create a workspace,
   project, and tasks without providing personal information.
5. Signing out ends access to that guest identity. The session cannot be
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

Before Supabase account creation, Redis atomically allows at most 3 attempts
per IP per hour, 10 attempts per IP per UTC day, and 100 successful guest
reservations globally per UTC day. IP addresses are HMAC-hashed before they are
used in Redis keys. A failed Supabase or CAPTCHA request releases only its
global reservation; its per-IP attempt still counts. If Redis is unavailable,
guest creation fails closed while existing authenticated sessions continue to
work.

## Deployment setup

1. Apply all database migrations in filename order, including
   `230_anonymous_guest_limits.sql`. Repository files do not modify the hosted
   database until their SQL is run in the Supabase SQL Editor.
2. In Cloudflare Turnstile, create a **Managed** widget and add every deployed
   frontend hostname. Copy its site key and secret key.
3. In Supabase, enable **Authentication → Providers → Anonymous Sign-Ins**.
4. Under **Authentication → Bot and Abuse Protection**, choose Cloudflare
   Turnstile, enter the Turnstile **secret key**, and enable CAPTCHA. The secret
   belongs only in Supabase and must not be added to Boardnest environment
   variables.
5. Set `VITE_TURNSTILE_SITE_KEY` to the public site key in the frontend build
   environment. Because this is a Vite variable, rebuild/redeploy the frontend.
6. Set a random `GUEST_RATE_LIMIT_SECRET` of at least 32 characters and the
   existing `REDIS_URL` in the API environment. Rotating this secret resets the
   effective per-IP counters.
7. Keep `TRUST_PROXY_HOPS=0` locally. In production, set it to the exact number
   of trusted reverse proxies between the client and Node (commonly `1` on a
   single-proxy deployment), after verifying the hosting topology. An incorrect
   value can collapse all clients into one bucket or trust a spoofed address.
8. Keep the Supabase anonymous-sign-in IP rate limit enabled.
9. Confirm the frontend and API origins match the configured CORS and cookie
   settings.
10. Verify the flow from `/login` by completing Turnstile and selecting
    **Continue as guest**.

Confirm that the guest workspace trigger is installed:

```sql
select tgname
from pg_trigger
where tgname = 'workspaces_enforce_anonymous_quota'
  and not tgisinternal;
```

The query must return `workspaces_enforce_anonymous_quota`. `Success. No rows
returned` means migration `230_anonymous_guest_limits.sql` has not been applied.
Applying the migration does not delete resources that guests created before the
triggers were installed; it prevents subsequent inserts above the quotas.

For local development, use a real widget that allows `localhost`, or use
Cloudflare's documented test site/secret pair only with a separate development
Supabase project. Never deploy the always-pass test credentials to production.

## Production considerations

- Supabase anonymous users are persistent Auth records and are not removed
  automatically. A production deployment should periodically delete abandoned
  guest data and anonymous users after a defined retention period.
- Turnstile, Redis admission limits, Supabase's own rate limit, and the database
  quotas are independent layers. Keep all of them enabled for a public demo.
- A guest may create one invitation. Delivery works when the server-side Resend
  integration is configured, but only a registered account with the invited
  email can accept it.
- A guest account cannot currently be upgraded in place to a permanent
  Boardnest account.

## Verification

The API test suite covers guest-session creation, cookie issuance, admission
limits, and token non-disclosure. TypeScript, lint, unit/component tests,
production builds, and the Playwright browser workflow exercise the guest mode.

Database quota triggers require an isolated Supabase-compatible PostgreSQL
environment for runtime verification. Never run the transactional database
smoke test against the hosted production project.
