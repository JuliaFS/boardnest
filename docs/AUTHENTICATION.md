# Authentication

## Architecture

Supabase Auth owns passwords, email confirmation, access tokens, refresh tokens,
and session renewal. Boardnest never stores passwords. The browser persists the
Supabase session and sends its access token as a bearer token to the Node API.

The API verifies token claims with `supabase.auth.getClaims()`. With asymmetric
signing keys this uses the project's cached public JWKS; with a shared signing
key the client safely falls back to the Supabase Auth server. The API requires
the expected `authenticated` role and a valid user UUID.

Business data still goes through the Boardnest API. The public Supabase key does
not grant trusted backend privileges, and the service-role key is never sent to
the browser.

## Supabase Dashboard settings

Under **Authentication → URL Configuration** set:

- Site URL: `http://localhost:5173`
- Redirect URLs: add `http://localhost:5173/**` for local development

Under **Authentication → Providers → Email**, keep the Email provider enabled.
Choose whether to require email confirmation. Both modes are supported:

- confirmation enabled: registration shows a "Check your email" screen;
- confirmation disabled: registration creates a session and opens the dashboard.

For production, replace local URLs with the deployed HTTPS frontend URL and
remove broad wildcard redirects that are no longer needed.

## Local configuration

Copy `.env.example` to `.env`, then replace these placeholders:

```dotenv
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-public-key
VITE_API_URL=http://localhost:4000

SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-public-key
CORS_ORIGIN=http://localhost:5173
```

The two publishable-key variables intentionally contain the same public value.
Do not paste the Supabase secret/service-role key into either one.

## Manual verification

1. Run `pnpm dev` and open `http://localhost:5173/register`.
2. Register with a display name, email, and strong password.
3. If email confirmation is enabled, follow the email link and then sign in.
4. Confirm the dashboard reports that the API session is verified.
5. Refresh the browser and confirm the session remains active.
6. Sign out and confirm `/dashboard` redirects to `/login`.
7. In Supabase, verify the Auth user has the expected matching `profiles` row.

The dashboard intentionally uses Auth metadata for the display name in Phase 3.
Profile and workspace data will be loaded through GraphQL after Phase 4.
