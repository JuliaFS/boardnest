# Authentication

## Architecture

Supabase Auth owns passwords, email confirmation, access tokens, refresh tokens,
and the underlying session. Boardnest never stores passwords.

The browser talks only to the Node API. After login, registration, or PKCE email
confirmation, the API writes the Supabase access and refresh tokens to separate
`HttpOnly` cookies. Browser JavaScript cannot read either token, and no token is
stored in `localStorage` or returned in a JSON response.

Authentication cookies use:

- `HttpOnly` to block JavaScript access;
- configurable `SameSite=Lax` or `SameSite=None` plus strict `Origin`
  validation on auth and GraphQL mutations for CSRF protection;
- `Secure` in production;
- host-only scope and `Path=/`.

The API verifies the access token for authenticated requests. When it expires,
the API rotates the one-time refresh token and replaces both cookies. Concurrent
refreshes inside one API process share the same rotation request.

Responses that create, refresh, or clear a session use `Cache-Control: private,
no-store` so a proxy must not cache `Set-Cookie` headers.

## Supabase Dashboard settings

Under **Authentication → URL Configuration** set:

- Site URL: `http://localhost:5174`
- Redirect URLs: add `http://localhost:4000/auth/callback`

The callback URL points to the API, not the React application. The API exchanges
the short-lived PKCE authorization code, stores the resulting session in
`HttpOnly` cookies, and redirects the browser to `/dashboard`.

Under **Authentication → Providers → Email**, keep the Email provider enabled.
Under **Authentication → Providers → Anonymous Sign-Ins**, enable anonymous
sign-ins for the guest demo. Supabase anonymous users receive an authenticated
session with an is_anonymous JWT claim; Boardnest uses that claim for database
enforcement and never treats the public anon role as a guest account.

The login and registration forms render Cloudflare Turnstile and send its
single-use token with every password sign-in, signup, or guest request. The API
forwards it to the corresponding Supabase Auth operation, so Supabase performs
server-side CAPTCHA validation before authenticating or creating a user. The
widget resets after each attempt because a token cannot be reused.
Redis additionally limits guest creation to 3 attempts per IP per hour, 10 per
IP per UTC day, and 100 successful reservations globally per UTC day. Anonymous
users are persistent Auth records, so schedule periodic cleanup for abandoned
users after the chosen retention period.

Both email-confirmation modes are supported:

- confirmation enabled: registration shows a "Check your email" screen;
- confirmation disabled: registration immediately creates the cookie session.

For production, replace both localhost origins with their HTTPS deployment URLs
and allow the exact production API callback URL in Supabase.

Prefer a frontend and API on subdomains of the same registered domain and use
`COOKIE_SAME_SITE=lax`. Temporary `vercel.app` plus `railway.app` deployments
need `COOKIE_SAME_SITE=none`, which always requires `Secure` production cookies
and can still be affected by browser third-party-cookie blocking. See
[Production deployment](DEPLOYMENT.md).

## Local configuration

Copy `.env.example` to `.env`, then set:

```dotenv
VITE_API_URL=http://localhost:4000

API_URL=http://localhost:4000
COOKIE_SAME_SITE=lax
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-public-key
CORS_ORIGIN=http://localhost:5174
NODE_ENV=development
```

The Supabase values are server-side only. `SUPABASE_SERVICE_ROLE_KEY` is needed
by account deletion and the optional reminder scheduler. It must never be used
in a `VITE_*` variable.

## API endpoints

| Method | Path                     | Purpose                               |
| ------ | ------------------------ | ------------------------------------- |
| POST   | `/auth/register`         | Create a Supabase account             |
| POST   | `/auth/guest`            | Create an anonymous guest session     |
| POST   | `/auth/login`            | Create the `HttpOnly` cookie session  |
| GET    | `/auth/callback`         | Complete PKCE email confirmation      |
| GET    | `/auth/session`          | Verify or refresh the current session |
| POST   | `/auth/logout`           | Revoke and clear the current session  |
| GET    | `/auth/account-deletion` | Preview ownership decisions           |
| POST   | `/auth/account-deletion` | Permanently delete the account        |

## Account deletion

The Settings page loads a server-calculated impact preview. A sole owner must
transfer every shared workspace to an existing member. A workspace containing
only that owner can instead be selected for permanent deletion. If another
owner already exists, the workspace remains unchanged.

Submission requires the exact `DELETE` confirmation and passes the current
session identity to a service-role-only preparation transaction. The API never
accepts a target user ID from the browser. It deletes the Supabase Auth user
only after all ownership decisions succeed, then clears the HttpOnly cookies.
Shared projects are retained and their creator attribution becomes `NULL`;
personal workspaces selected by the user cascade-delete their projects and
tasks.

## Manual verification

1. Run `pnpm dev` and open `http://localhost:5174/register`.
2. Register and, when enabled, follow the email confirmation link.
3. Confirm the dashboard reports an API-verified cookie session.
4. In DevTools → Application → Local storage, confirm no `sb-...-auth-token` exists.
5. In DevTools → Application → Cookies → `http://localhost`, confirm
   `boardnest-access` and `boardnest-refresh` have `HttpOnly` and `SameSite=Lax`.
6. Refresh the page and confirm the session remains active.
7. Sign out and confirm both cookies disappear and `/dashboard` redirects to `/login`.
8. From `/login`, choose **Continue as guest** and confirm the dashboard shows
   the guest limits banner. Verify that a second workspace or project and the
   twenty-first task are rejected with a readable limit message.

The frontend session endpoint supplies the authenticated header identity, while
GraphQL exposes `currentUser` and all authorized application data through
Apollo Client.
