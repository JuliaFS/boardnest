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
- `SameSite=Lax` plus strict `Origin` validation on auth mutations for CSRF protection;
- `Secure` in production;
- host-only scope and `Path=/`.

The API verifies the access token for authenticated requests. When it expires,
the API rotates the one-time refresh token and replaces both cookies. Concurrent
refreshes inside one API process share the same rotation request.

Responses that create, refresh, or clear a session use `Cache-Control: private,
no-store` so a proxy must not cache `Set-Cookie` headers.

## Supabase Dashboard settings

Under **Authentication → URL Configuration** set:

- Site URL: `http://localhost:5173`
- Redirect URLs: add `http://localhost:4000/auth/callback`

The callback URL points to the API, not the React application. The API exchanges
the short-lived PKCE authorization code, stores the resulting session in
`HttpOnly` cookies, and redirects the browser to `/dashboard`.

Under **Authentication → Providers → Email**, keep the Email provider enabled.
Both email-confirmation modes are supported:

- confirmation enabled: registration shows a "Check your email" screen;
- confirmation disabled: registration immediately creates the cookie session.

For production, replace both localhost origins with their HTTPS deployment URLs
and allow the exact production API callback URL in Supabase.

## Local configuration

Copy `.env.example` to `.env`, then set:

```dotenv
VITE_API_URL=http://localhost:4000

API_URL=http://localhost:4000
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-public-key
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development
```

The Supabase values are server-side only. `SUPABASE_SERVICE_ROLE_KEY` is not
needed for authentication and must never be used in a `VITE_*` variable.

## API endpoints

| Method | Path             | Purpose                               |
| ------ | ---------------- | ------------------------------------- |
| POST   | `/auth/register` | Create a Supabase account             |
| POST   | `/auth/login`    | Create the `HttpOnly` cookie session  |
| GET    | `/auth/callback` | Complete PKCE email confirmation      |
| GET    | `/auth/session`  | Verify or refresh the current session |
| POST   | `/auth/logout`   | Revoke and clear the current session  |

## Manual verification

1. Run `pnpm dev` and open `http://localhost:5173/register`.
2. Register and, when enabled, follow the email confirmation link.
3. Confirm the dashboard reports an API-verified cookie session.
4. In DevTools → Application → Local storage, confirm no `sb-...-auth-token` exists.
5. In DevTools → Application → Cookies → `http://localhost`, confirm
   `boardnest-access` and `boardnest-refresh` have `HttpOnly` and `SameSite=Lax`.
6. Refresh the page and confirm the session remains active.
7. Sign out and confirm both cookies disappear and `/dashboard` redirects to `/login`.

The dashboard uses Auth metadata for the display name in Phase 3. Profile and
workspace data will be loaded through GraphQL after Phase 4.
