# Mobile application

## Scope

`apps/mobile` is the native Boardnest client built with Expo SDK 58, React Native 0.88, TypeScript, and Expo Router. It provides native authentication, protected navigation, a platform-specific Apollo Client, and shared generated GraphQL contracts.

The existing Vite application remains the browser client. Mobile is an additional presentation layer, not a replacement for the web application.

## Architecture boundary

```text
Web client ───────┐
                  ├── Boardnest GraphQL API ── Supabase PostgreSQL
Mobile client ────┘              │
                                 ├── Redis event bus
                                 └── notification workers
```

Both clients will use the same API, users, workspaces, projects, tasks, and notification data. Mobile business operations must go through the GraphQL API rather than querying business tables directly. This preserves API validation, authorization, plan limits, event publication, and PostgreSQL RLS behavior.

Platform-specific UI stays inside each application. Framework-independent validation, GraphQL documents, generated types, constants, and pure domain functions may move into workspace packages only when both clients need them.

## Shared GraphQL contracts

`packages/graphql-types` is generated from the API schema and owns the typed
documents shared by web and mobile. The first shared operation is
`MobileConnection`, a public `currentUser` query used to prove that both clients
compile against the same contract. A missing session is a valid public result.

Apollo configuration remains platform-specific:

- `apps/web/src/lib/apollo-client.ts` uses browser cookies and WebSockets;
- `apps/mobile/src/lib/apollo.ts` reads the current native session and adds its
  bearer access token to GraphQL requests.

After changing the API schema or a shared operation, regenerate the contract:

```bash
pnpm graphql:generate
```

`pnpm graphql:check` performs a dry-run comparison. CI runs it explicitly so a
schema or document change cannot be merged with stale generated types.

## Authentication

The web client continues to use secure HTTP-only cookies. Mobile uses the same
Supabase Auth project with a platform-specific session:

- access and refresh session data is persisted through Expo SecureStore on
  native devices;
- Supabase restores and refreshes the session according to the application
  lifecycle;
- Apollo sends the current access token through `Authorization: Bearer`;
- the API accepts bearer authentication for GraphQL HTTP and WebSocket
  connection parameters while retaining cookie authentication for web;
- the request-scoped Supabase client receives the verified user token, so
  PostgreSQL RLS remains authoritative.

Registration, login, logout, email confirmation, password recovery, protected
routes, and account deletion are available in the native client. Guest mode is
deliberately deferred because guest-device identity migration requires a
separate lifecycle.

The configured deep links are:

- `boardnest://auth/callback`;
- `boardnest://auth/reset-password`;
- `boardnest://invite/:token`.

Add the two auth URLs to the Supabase Auth redirect allow list. Android App Links
will be added after the native release pipeline is established.

`Linking.createURL` produces these custom-scheme URLs in a development or store
build. Expo Go produces an `exp://.../--/auth/...` development URL instead; add
that exact URL to the Supabase allow list when testing email links in Expo Go.

Service-role keys and infrastructure credentials remain server-only. Values prefixed with `EXPO_PUBLIC_` are part of the mobile bundle and are never secrets.

## Navigation foundation

Expo Router owns mobile navigation. Routes live in `apps/mobile/src/app`, with a root stack and a four-tab application shell:

- Dashboard;
- Projects;
- Notifications;
- Settings.

The authenticated stack also reserves typed destinations for workspace,
project, and task details:

- `/workspaces/:workspaceId`;
- `/projects/:projectId`;
- `/projects/:projectId/tasks/:taskId`.

Route builders in `apps/mobile/src/navigation/routes.ts` encode identifiers
before navigation. The Projects tab includes a temporary route preview until
the native workspace and project queries are connected.

## Native design system

Reusable native controls live in `apps/mobile/src/components/ui`. The first
design-system layer includes buttons, labeled text fields, safe-area screens,
a focus-aware bottom sheet, persistent banners, transient toast feedback, and
loading, error, and empty states. Interactive controls use a minimum 48-point
touch target, expose screen-reader roles and labels, and announce asynchronous
errors and feedback through live regions.

Semantic color, spacing, radius, and typography tokens live in
`apps/mobile/src/theme`. The application deliberately keeps the existing dark
appearance for this phase. Components consume semantic tokens so a light theme
can be introduced later without duplicating component behavior.

Unauthenticated users are restricted to the auth route group. A restored session
opens the tab shell, and logout clears both Supabase storage and Apollo cache.

The application scheme is `boardnest`, and the reserved Android package and iOS bundle identifiers are `com.juliafs.boardnest`. Changing these identifiers after publishing a store application would create a different application identity.

## Development

From the repository root:

```bash
nvm use
corepack enable
pnpm install
pnpm dev:mobile
```

Expo detects the pnpm workspace automatically. The checked-in Metro
configuration contains only the documented `tslib` compatibility alias required
by the server renderer.

See [`apps/mobile/README.md`](../apps/mobile/README.md) for device setup, local network addresses, environment safety, and focused quality commands.

## Planned phases

1. Native workspace and project flows.
2. Tasks, comments, and mobile board interactions.
3. GraphQL subscription reconnection and cache synchronization.
4. Notification inbox, reminders, and preferences.
5. Push delivery, mobile hardening, testing, and Google Play release preparation.
