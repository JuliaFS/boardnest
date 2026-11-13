# Boardnest Mobile

Boardnest Mobile is the Expo and React Native client for the existing Boardnest platform. It lives in the same pnpm monorepo as the web and API applications, while keeping native presentation code separate from browser-specific UI.

The mobile foundation currently provides:

- Expo SDK 58 and React Native 0.88;
- Expo Router with typed file-based routes;
- initial Dashboard, Projects, Notifications, and Settings tabs;
- Supabase registration, login, recovery, and secure session persistence;
- protected Expo Router routes and Boardnest deep links;
- a bearer-authenticated Apollo Client;
- shared generated GraphQL documents and result types;
- Boardnest color and spacing tokens;
- accessible reusable controls and standard loading, error, and empty states;
- protected workspace, project, and task route destinations;
- workspace listing, details, creation, editing, member roles, and permissions;
- project listing, details, lifecycle fields, membership, and deletion;
- task board columns, task CRUD, status changes, assignments, and comments;
- authenticated GraphQL WebSocket synchronization for tasks, comments, and memberships;
- notification inbox, unread badge, preferences, custom schedules, and email delivery history;
- Expo push permission, device registration, preferences, and safe notification routing;
- workspace invitations and protected native invitation acceptance;
- Android, iOS, and web development targets;
- monorepo lint and type-check integration.
- Vitest unit, Jest/React Native component and integration, and Maestro Android
  test layers.

The web and mobile clients use the same Supabase users. Web sessions remain in
HTTP-only cookies, while native sessions use Expo SecureStore and bearer tokens.

## Prerequisites

- Node.js and pnpm versions pinned by the repository;
- Expo Go on a compatible physical device, or an Android emulator;
- the computer and physical device connected to the same local network.

## Start the application

Run commands from the repository root unless a command explicitly changes directory:

```bash
nvm use
corepack enable
pnpm install
pnpm dev:mobile
```

Scan the terminal QR code with Expo Go, or press `a` to open an available Android emulator. Press `w` to verify the universal web target.

During the Expo SDK 58 transition, the public Expo Go store application may temporarily target the previous SDK. If it cannot open this project, use an Android emulator or create a development build instead of downgrading the repository.

Remote push notifications require a physical device and the checked-in EAS
development client profile; they cannot be fully tested in Expo Go. Add the EAS
project UUID as `EXPO_PUBLIC_EAS_PROJECT_ID`, build from `apps/mobile` with
`pnpm dlx eas-cli@latest build --profile development --platform android`, and
install the generated APK before enabling push in Notification preferences.

## Local API addresses

Copy `apps/mobile/.env.example` to `apps/mobile/.env.local` and set
the API addresses, Supabase publishable values, and Turnstile site key.

A physical device cannot reach the computer through `localhost`. Replace `192.168.1.100` with the computer's LAN address. An Android emulator normally reaches the host through `10.0.2.2`.

For an Android emulator, use:

```dotenv
EXPO_PUBLIC_GRAPHQL_URL=http://10.0.2.2:4000/graphql
EXPO_PUBLIC_WS_URL=ws://10.0.2.2:4000/graphql
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
```

For a physical device, use the development computer's LAN address:

```dotenv
EXPO_PUBLIC_GRAPHQL_URL=http://192.168.1.100:4000/graphql
EXPO_PUBLIC_WS_URL=ws://192.168.1.100:4000/graphql
EXPO_PUBLIC_API_URL=http://192.168.1.100:4000
```

Add `boardnest://auth/callback` and `boardnest://auth/reset-password` to Supabase
Authentication > URL Configuration > Redirect URLs. The Turnstile widget uses
`EXPO_PUBLIC_WEB_URL` as its trusted base URL, so that hostname must be allowed
by the corresponding Cloudflare Turnstile widget.

Expo Go uses an `exp://<host>:<port>/--/auth/...` redirect rather than the
standalone `boardnest://` scheme. Allow the exact development URLs shown by the
running Expo server, or use a development build to test the final scheme.

Start Redis and the API with `pnpm redis:up` and `pnpm dev`. Sign in with an
existing web account, close Expo Go, reopen the project, and verify that the
session is restored. The Dashboard GraphQL query must return that same user.

The Dashboard lists the same workspace records as the web client. Owners and
admins can create or edit a workspace and manage non-owner member roles from the
workspace details screen. Members and viewers can inspect the roster but cannot
open management controls. Duplicate slugs are rejected by the API with a clear
message and remain globally unique across Boardnest.

The Projects tab scopes its list to a selected workspace. Workspace
contributors may create projects, while project leads and workspace managers
may edit project details and manage explicit project roles. Only workspace
owners and admins receive the destructive project deletion control. PostgreSQL
RLS remains authoritative for every operation.

Workspace owners and admins can create and revoke invitations from workspace
details. Registered managers can use Change email to replace a pending,
unexpired invitation atomically while preserving its role. Email delivery uses the API's configured provider. If delivery is not
available, the one-time web acceptance URL is displayed as a development
fallback. The `/invite/:token` mobile route accepts an email token or an invitation UUID,
preserves it through login, and accepts only when the authenticated email
matches. In-app invitations are created for already-registered recipients
whose in-app preferences allow them; they contain no raw email token.

The Android manifest declares a verified App Link for
`https://boardnest-web-omega.vercel.app/invite/*`. A store or development build
requires the matching Digital Asset Links file on the Vercel domain; Expo Go
does not verify Android App Links. See `docs/MOBILE.md` for the production
certificate step.

Project details link to a native task board. The first board version uses
accessible column tabs and an explicit status selector instead of gesture-only
drag and drop. Task creation and editing support priority and optional due
dates. Task details provide assignments, comments, and deletion according to
workspace/project permissions. Status changes update optimistically and restore
the previous column state if the API rejects the mutation. Native gestures and
animations are intentionally deferred until the menu-based workflow has been
validated on small screens.

The Notifications tab uses the same recipient-scoped inbox, preferences,
workspace plan limits, personal schedules, and delivery history as the web
client. Ordinary native destinations use structured workspace, project, and task
identifiers plus event type. Workspace invitations instead validate the UUID
in `payload.invitationId` and open the acceptance screen. The mobile client does
not read or execute a web route from notification JSON payloads. Unread entries
are marked optimistically, and the tab badge updates immediately with a visual
cap of `99+`.

The native Apollo transport opens authenticated `graphql-transport-ws`
connections with the current Supabase bearer token. It reconnects after network
loss or foreground restoration, then refetches active queries to recover any
events missed while disconnected. Task events update the board immediately;
comment and membership events refetch their scoped detail data. A bounded event
deduplicator prevents repeated deliveries from being applied twice.

The mobile lifecycle layer monitors device reachability and application state.
When the device is offline, an accessible banner explains that previously
loaded Apollo cache data remains available while GraphQL mutations are blocked.
Queries use bounded retry with jitter and a 15-second request timeout; mutations
are never retried automatically because the server may already have committed a
timed-out request. Returning online or bringing the application to the
foreground reconnects subscriptions and refetches active queries. Notification
badge polling pauses in the background and while offline. Logout clears the
private Apollo cache. This first version deliberately does not persist an
offline mutation queue or attempt conflict resolution.

`@react-native-community/netinfo` is a native dependency. Rebuild the EAS
development client after pulling this phase; restarting Metro alone cannot add
the native module to an already installed binary.

All `EXPO_PUBLIC_*` values are embedded in the application bundle and must be treated as public. Never place a Supabase service-role key, SMTP password, Redis URL, Railway token, or any other secret in the mobile environment.

## Quality checks

```bash
pnpm --filter @boardnest/mobile lint
pnpm --filter @boardnest/mobile typecheck
pnpm --filter @boardnest/mobile test
pnpm --filter @boardnest/mobile test:components:coverage
pnpm --filter @boardnest/mobile doctor
pnpm graphql:check
```

The root `pnpm lint`, `pnpm typecheck`, and `pnpm test:ci` commands validate
mobile source and run both mobile test runners in GitHub Actions. Device-level
flows live in `.maestro`; see its README and the **Mobile E2E** workflow for the
installed-APK test procedure.

## Project boundaries

- Routes belong in `src/app`.
- Reusable native components belong in `src/components`.
- Theme tokens belong in `src/theme`.
- Shared native controls and feedback patterns belong in `src/components/ui`.
- Route construction belongs in `src/navigation`; identifiers must be encoded before navigation.
- Browser DOM components, web Tailwind classes, React Router code, and cookie handling must not be imported into the mobile application.
- Shared GraphQL documents and generated types must be imported from `@boardnest/graphql-types`; Apollo transport and authentication stay inside the mobile application.
- Native behavior must be configured through Expo config and plugins. Generated `android` and `ios` folders are not committed.
- Offline mutations must fail explicitly. Do not add a mutation queue without a documented idempotency and conflict-resolution strategy.
- The local Metro configuration redirects `tslib` to its portable ESM build because the server renderer cannot interoperate with the Node-specific wrapper selected by GraphQL dependencies. Revisit this compatibility setting during Expo SDK upgrades.
