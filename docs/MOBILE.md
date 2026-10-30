# Mobile application

## Scope

`apps/mobile` is the native Boardnest client built with Expo SDK 58, React Native 0.88, TypeScript, and Expo Router. The first foundation phase establishes the application boundary, navigation shell, design tokens, configuration conventions, and repository quality checks. It intentionally does not connect authentication or GraphQL data.

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

## Authentication direction

The current web client continues to use secure HTTP-only cookies. A later mobile authentication phase will add API support for Supabase bearer access tokens without removing cookie authentication. The native client will store session material in platform secure storage, attach the access token to GraphQL HTTP requests, and provide it in WebSocket connection parameters.

Service-role keys and infrastructure credentials remain server-only. Values prefixed with `EXPO_PUBLIC_` are part of the mobile bundle and are never secrets.

## Navigation foundation

Expo Router owns mobile navigation. Routes live in `apps/mobile/src/app`, with a root stack and a four-tab application shell:

- Dashboard;
- Projects;
- Notifications;
- Settings.

The placeholder screens verify navigation, safe-area behavior, scrolling, accessibility semantics, and the initial Boardnest visual language before feature modules are connected.

The application scheme is `boardnest`, and the reserved Android package and iOS bundle identifiers are `com.juliafs.boardnest`. Changing these identifiers after publishing a store application would create a different application identity.

## Development

From the repository root:

```bash
nvm use
corepack enable
pnpm install
pnpm dev:mobile
```

Expo automatically detects the pnpm workspace and configures Metro for the monorepo. No custom Metro configuration is required.

See [`apps/mobile/README.md`](../apps/mobile/README.md) for device setup, local network addresses, environment safety, and focused quality commands.

## Planned phases

1. Shared GraphQL documents and generated types.
2. Mobile bearer authentication and secure session storage.
3. Native workspace and project flows.
4. Tasks, comments, and mobile board interactions.
5. GraphQL subscription reconnection and cache synchronization.
6. Notification inbox, reminders, and preferences.
7. Push delivery, mobile hardening, testing, and Google Play release preparation.
