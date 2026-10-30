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
- Android, iOS, and web development targets;
- monorepo lint and type-check integration.

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

## Local API addresses

Copy `apps/mobile/.env.example` to `apps/mobile/.env.local` and set
the API addresses, Supabase publishable values, and Turnstile site key.

A physical device cannot reach the computer through `localhost`. Replace `192.168.1.100` with the computer's LAN address. An Android emulator normally reaches the host through `10.0.2.2`.

For an Android emulator, use:

```dotenv
EXPO_PUBLIC_GRAPHQL_URL=http://10.0.2.2:4000/graphql
EXPO_PUBLIC_API_URL=http://10.0.2.2:4000
```

For a physical device, use the development computer's LAN address:

```dotenv
EXPO_PUBLIC_GRAPHQL_URL=http://192.168.1.100:4000/graphql
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

All `EXPO_PUBLIC_*` values are embedded in the application bundle and must be treated as public. Never place a Supabase service-role key, SMTP password, Redis URL, Railway token, or any other secret in the mobile environment.

## Quality checks

```bash
pnpm --filter @boardnest/mobile lint
pnpm --filter @boardnest/mobile typecheck
pnpm --filter @boardnest/mobile test
pnpm --filter @boardnest/mobile doctor
pnpm graphql:check
```

The root `pnpm lint` and `pnpm typecheck` commands also validate mobile source code.

## Project boundaries

- Routes belong in `src/app`.
- Reusable native components belong in `src/components`.
- Theme tokens belong in `src/theme`.
- Shared native controls and feedback patterns belong in `src/components/ui`.
- Route construction belongs in `src/navigation`; identifiers must be encoded before navigation.
- Browser DOM components, web Tailwind classes, React Router code, and cookie handling must not be imported into the mobile application.
- Shared GraphQL documents and generated types must be imported from `@boardnest/graphql-types`; Apollo transport and authentication stay inside the mobile application.
- Native behavior must be configured through Expo config and plugins. Generated `android` and `ios` folders are not committed.
- The local Metro configuration redirects `tslib` to its portable ESM build because the server renderer cannot interoperate with the Node-specific wrapper selected by GraphQL dependencies. Revisit this compatibility setting during Expo SDK upgrades.
