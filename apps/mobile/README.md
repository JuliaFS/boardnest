# Boardnest Mobile

Boardnest Mobile is the Expo and React Native client for the existing Boardnest platform. It lives in the same pnpm monorepo as the web and API applications, while keeping native presentation code separate from browser-specific UI.

The mobile foundation currently provides:

- Expo SDK 58 and React Native 0.88;
- Expo Router with typed file-based routes;
- initial Dashboard, Projects, Notifications, and Settings tabs;
- a native Apollo Client and public GraphQL connectivity check;
- shared generated GraphQL documents and result types;
- Boardnest color and spacing tokens;
- Android, iOS, and web development targets;
- monorepo lint and type-check integration.

The public query does not require authentication. Mobile bearer authentication
and protected feature data are intentionally reserved for the next phase.

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

## Local API addresses

Copy `apps/mobile/.env.example` to `apps/mobile/.env.local` and set
`EXPO_PUBLIC_GRAPHQL_URL` to an address the selected device can reach.

A physical device cannot reach the computer through `localhost`. Replace `192.168.1.100` with the computer's LAN address. An Android emulator normally reaches the host through `10.0.2.2`.

For an Android emulator, use:

```dotenv
EXPO_PUBLIC_GRAPHQL_URL=http://10.0.2.2:4000/graphql
```

For a physical device, use the development computer's LAN address:

```dotenv
EXPO_PUBLIC_GRAPHQL_URL=http://192.168.1.100:4000/graphql
```

Start Redis and the API with `pnpm redis:up` and `pnpm dev`, then open the
Dashboard. A successful unauthenticated request reports that the public query
completed without a session. This is expected until mobile authentication is
implemented.

All `EXPO_PUBLIC_*` values are embedded in the application bundle and must be treated as public. Never place a Supabase service-role key, SMTP password, Redis URL, Railway token, or any other secret in the mobile environment.

## Quality checks

```bash
pnpm --filter @boardnest/mobile lint
pnpm --filter @boardnest/mobile typecheck
pnpm --filter @boardnest/mobile doctor
pnpm graphql:check
```

The root `pnpm lint` and `pnpm typecheck` commands also validate mobile source code.

## Project boundaries

- Routes belong in `src/app`.
- Reusable native components belong in `src/components`.
- Theme tokens belong in `src/theme`.
- Browser DOM components, web Tailwind classes, React Router code, and cookie handling must not be imported into the mobile application.
- Shared GraphQL documents and generated types must be imported from `@boardnest/graphql-types`; Apollo transport and authentication stay inside the mobile application.
- Native behavior must be configured through Expo config and plugins. Generated `android` and `ios` folders are not committed.
- The local Metro configuration redirects `tslib` to its portable ESM build because the server renderer cannot interoperate with the Node-specific wrapper selected by GraphQL dependencies. Revisit this compatibility setting during Expo SDK upgrades.
