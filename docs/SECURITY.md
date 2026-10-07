# Security

## Trust boundaries

Boardnest treats every browser request, GraphQL variable, URL parameter, and
WebSocket connection as untrusted. The Node API is the browser-facing trust
boundary. PostgreSQL constraints, grants, and Row Level Security (RLS) are the
final resource-authorization boundary.

```text
Browser
  -> exact-origin API / WebSocket checks
  -> authenticated Node API
  -> request-scoped Supabase client carrying the user's JWT
  -> PostgreSQL grants, constraints, triggers, and RLS
```

Redis is not an authorization system or source of truth. Subscription access is
verified against PostgreSQL before an event stream is opened.

## Authentication and session protection

- Supabase Auth owns passwords, password hashing, email confirmation, access
  tokens, and refresh tokens. Boardnest stores no password.
- The API is an authentication backend-for-frontend. Tokens are written to
  host-only `HttpOnly` cookies and are never returned to React or stored in
  browser storage.
- Production cookies are always `Secure`. `SameSite=Lax` is preferred for
  same-site subdomains; cross-site provider domains require
  `SameSite=None; Secure`.
- Registration confirmation uses a short-lived PKCE code. The verifier is kept
  in an `HttpOnly` cookie and the callback is handled by the API.
- Expired access tokens are refreshed server-side. Session-changing responses
  use `Cache-Control: private, no-store`.
- Logout asks Supabase to revoke the session and clears both local cookies.

See [Authentication](AUTHENTICATION.md) for the complete flow.

## CSRF, CORS, and WebSocket origin controls

Cookie authentication requires explicit cross-site request controls:

- CORS allows credentials only from the single configured `CORS_ORIGIN`;
- authentication mutations reject requests whose `Origin` is not that exact
  origin;
- Apollo CSRF prevention protects GraphQL HTTP requests;
- WebSocket connection setup independently checks the exact browser origin;
- `SameSite` cookies provide an additional browser-level boundary but are not
  treated as the only CSRF defense.

Production `CORS_ORIGIN`, Supabase redirect URLs, and frontend URLs must match
exactly, including scheme and port.

## Authorization and multi-tenancy

- Every tenant-owned row is connected to a workspace, directly or through its
  project/task relationship.
- Workspace roles are `owner`, `admin`, `member`, and `viewer`; project roles
  cannot elevate a workspace role.
- Private projects require explicit project membership, except that workspace
  owners and admins retain administrative access.
- GraphQL resolvers require authentication and use a Supabase client carrying
  the current user's JWT. Normal requests never use the service-role key. Only
  the background reminder scheduler and authenticated account-deletion service
  use it to call their dedicated RPCs.
- RLS helpers live in a non-exposed `private` schema with controlled execution
  grants and fully qualified relation names.
- Database triggers protect cross-tenant relationships and invariants such as
  the final workspace owner.
- Account deletion derives the target exclusively from the verified session,
  validates the exact trusted origin, requires `DELETE`, and makes every
  sole-owned workspace transfer or deletion explicit.

The detailed permission matrix is in [Database](DATABASE.md).

## Input and query safety

- Zod validates authentication bodies, GraphQL UUIDs, strings, dates,
  pagination, and update payloads at the API boundary.
- GraphQL validates operation shape and enum values before resolver execution.
- Request JSON bodies are capped at 100 KB.
- Operation depth is capped at 10 and list sizes at 100.
- Production GraphQL introspection and stack traces are disabled.
- Supabase/PostgREST query builders parameterize filters; application code does
  not concatenate user input into SQL.
- PostgreSQL adds type, foreign-key, unique, check, and tenant-consistency
  enforcement even when an application validation path is missed.

## Browser and XSS considerations

React escapes interpolated text by default, and Boardnest does not render
user-provided HTML. Authentication tokens remain unreadable to JavaScript, so
a normal DOM injection cannot directly copy them. This does not make XSS
harmless: injected code could still issue same-origin actions as the user.
Avoid `dangerouslySetInnerHTML`, validate future rich-text formats, and keep
third-party dependencies current.

The production frontend serves hashed static assets. A stricter Content
Security Policy should be added before introducing third-party scripts,
analytics, user-generated HTML, or embedded content.

## Secrets and configuration

- `.env` and `.vercel` are ignored; only placeholder `.env.example` is tracked.
- `VITE_*` values are public by design and are embedded into the frontend
  bundle.
- Supabase service-role keys, database credentials, Redis credentials, Railway
  tokens, and Vercel tokens are server/provider secrets and must never use a
  `VITE_*` name.
- Runtime secrets live in Railway; public frontend configuration lives in
  Vercel; deployment credentials live in the protected GitHub `production`
  environment.
- Docker images do not copy `.env`, Git history, tests, coverage, or local
  `node_modules`, and runtime processes use non-root users.

If a secret is printed, committed, or pasted into an issue, revoke and rotate
it immediately. Removing it from the latest commit is insufficient because Git
history and logs may retain it.

## Error and logging policy

Known validation and data failures map to stable public GraphQL error codes.
Unexpected database details and stack traces are not returned in production.
Logs must describe the operation and failure category without recording cookie
values, authorization headers, Redis URLs, invitation tokens, or request bodies
containing credentials.

## Security verification checklist

Before a production release:

1. confirm no token appears in Local Storage, Session Storage, HTML, or JSON;
2. inspect cookies for `HttpOnly`, `Secure`, and the intended `SameSite` value;
3. verify an anonymous request is rejected;
4. verify a second user cannot read or mutate a private project;
5. verify a workspace viewer cannot perform contributor mutations;
6. verify an untrusted HTTP or WebSocket `Origin` is rejected;
7. run the SQL RLS smoke test only against an isolated disposable database;
8. run dependency, CI, Docker, and production smoke checks;
9. inspect logs and the built frontend for accidentally exposed secrets.

## Known hardening backlog

The current controls are appropriate for a portfolio release, but an
internet-facing service with untrusted traffic should additionally add:

- IP/account-aware rate limiting for authentication and GraphQL;
- weighted GraphQL query-cost analysis in addition to depth limits;
- automated dependency and secret scanning;
- Content Security Policy and other explicit browser security headers at the
  Vercel edge;
- durable audit/outbox handling for security-relevant events;
- automated expiration cleanup for invitations and session/device management;
- monitoring, alerting, backup restore exercises, and a documented incident
  response process.

These are explicit limitations; Redis Pub/Sub and RLS do not replace them.
