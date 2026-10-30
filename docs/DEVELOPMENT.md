# Development

## Toolchain

Boardnest pins Node.js 24.21.0 LTS and pnpm 12.4.2. Node 24 is the active LTS line at the start of development and satisfies the current Vite and Vitest runtime requirements.

```bash
nvm install
nvm use
corepack enable
corepack prepare pnpm@12.4.2 --activate
pnpm install
```

## Commands

| Command                   | Purpose                                  |
| ------------------------- | ---------------------------------------- |
| `pnpm dev`                | Run web and API development processes    |
| `pnpm dev:mobile`         | Run the Expo mobile development server   |
| `pnpm dev:mobile:android` | Start Expo and open Android              |
| `pnpm docker:build`       | Build the API and web container images   |
| `pnpm docker:config`      | Validate resolved Compose configuration  |
| `pnpm docker:up`          | Build and start the full Docker stack    |
| `pnpm docker:logs`        | Follow web, API, and Redis logs          |
| `pnpm docker:down`        | Remove the local Docker stack            |
| `pnpm format`             | Format supported repository files        |
| `pnpm format:check`       | Verify formatting without edits          |
| `pnpm graphql:generate`   | Regenerate shared GraphQL contracts      |
| `pnpm graphql:check`      | Reject stale generated GraphQL contracts |
| `pnpm lint`               | Run ESLint with zero warnings allowed    |
| `pnpm redis:up`           | Start and health-check local Redis       |
| `pnpm redis:logs`         | Follow local Redis container logs        |
| `pnpm redis:down`         | Stop the local Redis container           |
| `pnpm typecheck`          | Type-check every applicable workspace    |
| `pnpm test`               | Run workspace tests once                 |
| `pnpm test:ci`            | Run shared tests and API/web coverage    |
| `pnpm test:coverage`      | Run API/web tests with coverage gates    |
| `pnpm test:e2e`           | Run Playwright tests in Chromium         |
| `pnpm test:e2e:ui`        | Open the interactive Playwright runner   |
| `pnpm build`              | Produce application and package builds   |
| `pnpm check`              | Run the complete local quality gate      |

Run `pnpm check` before opening a pull request.

Install the Playwright browser once on a new machine:

```bash
pnpm exec playwright install chromium
```

Testing strategy, coverage thresholds, and opt-in integration checks are
documented in [Testing](TESTING.md).

Start Redis before the application:

```bash
pnpm redis:up
pnpm dev
```

The API intentionally fails during startup if it cannot connect to `REDIS_URL`.
This prevents an instance from appearing healthy while silently missing
cross-instance real-time events.

## Environment setup

Copy `.env.example` to `.env`. Do not replace the committed example with real values.

### Browser-visible variables

Every `VITE_*` variable is bundled into frontend code and must be treated as public:

- `VITE_API_URL`
- `VITE_GRAPHQL_URL`
- `VITE_WS_URL`

The frontend has no Supabase key and no JavaScript access to authentication tokens.

### Server-only variables

These values are read only by the API process:

- `API_URL`
- `COOKIE_SAME_SITE`
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `REDIS_URL`
- `PORT`
- `CORS_ORIGIN`
- `EMAIL_PROVIDER` (optional: `resend` or `smtp`)
- `RESEND_API_KEY` (optional, secret)
- `INVITATION_EMAIL_FROM` (required when email delivery is enabled)
- `SMTP_HOST`, `SMTP_PORT`, and `SMTP_SECURE` (required for SMTP)
- `SMTP_USER` and `SMTP_PASSWORD` (required for SMTP; server-only secrets)
- `CUSTOM_NOTIFICATION_SCHEDULER_ENABLED`
- `CUSTOM_NOTIFICATION_SCHEDULER_INTERVAL_MS`
- `CUSTOM_NOTIFICATION_SCHEDULER_BATCH_SIZE`
- `REMINDER_SCHEDULER_ENABLED`
- `REMINDER_SCHEDULER_INTERVAL_MS`
- `REMINDER_SCHEDULER_BATCH_SIZE`
- `EMAIL_DELIVERY_WORKER_ENABLED`
- `EMAIL_DELIVERY_WORKER_INTERVAL_MS`
- `EMAIL_DELIVERY_WORKER_BATCH_SIZE`
- `NODE_ENV`

`SUPABASE_PUBLISHABLE_KEY` is deliberately public and is also used by the API
client to support every Supabase signing-key mode. The service-role key and
direct database URL shown in `.env.example` are secrets. The service-role key is
required for account deletion, when either scheduler is enabled, and when
`EMAIL_DELIVERY_WORKER_ENABLED=true`.
Without it, ordinary local UI development still works but the deletion endpoint
returns 503. Never prefix secrets with `VITE_`, log them, commit them, or send
them to a browser.

Invitation records and manual fallback tokens work without an email provider.
To deliver through Resend, set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and a
verified `INVITATION_EMAIL_FROM`. Existing deployments that provide the two
Resend values without `EMAIL_PROVIDER` remain supported. To test with Gmail,
set `EMAIL_PROVIDER=smtp`, use `smtp.gmail.com`, port `587` with
`SMTP_SECURE=false` (STARTTLS), the Gmail address as `SMTP_USER`, and a Google
App Password as `SMTP_PASSWORD`. Port `465` with `SMTP_SECURE=true` is also
supported. Set `EMAIL_DELIVERY_WORKER_ENABLED=true` only after migration 370 is
applied; the worker uses the same SMTP transport and sender as invitations.
Never use the normal Gmail password or expose SMTP credentials to the browser.
Set `CUSTOM_NOTIFICATION_SCHEDULER_ENABLED=true` only after migration 410 is
applied. Its interval and batch settings have the same bounds as the task
reminder scheduler.

## Workspace conventions

- Use strict TypeScript and avoid `any`.
- Import types with `import type` when the import is type-only.
- Keep tests beside the source they verify.
- Add shared code only when at least two runtime boundaries truly share the concept.
- Keep domain logic out of React components and GraphQL resolver glue.
- Do not add infrastructure or dependencies before a concrete use case needs them.

## Git workflow

Use focused commits with Conventional Commit prefixes such as `feat:`, `fix:`,
`test:`, `docs:`, `refactor:`, `chore:`, and `ci:`. Every branch should remain
reviewable and leave the quality gate green.

## Current local endpoints

- Web: `http://localhost:5174`
- API health: `http://localhost:4000/health`
- API session check: `http://localhost:4000/auth/me`
- API authentication callback: `http://localhost:4000/auth/callback`
- GraphQL HTTP endpoint: `http://localhost:4000/graphql`
- GraphQL WebSocket endpoint: `ws://localhost:4000/graphql`

Both transports use the same GraphQL schema and path. Queries and mutations use
HTTP; subscriptions use the `graphql-transport-ws` WebSocket protocol.

For the containerized workflow, the web application uses
`http://localhost:8080` while the API remains on port `4000`. Do not run
`pnpm dev` and `pnpm docker:up` simultaneously with the default ports.
Detailed setup and port override examples are in [Docker](DOCKER.md).

## Mobile development

The Expo client lives in `apps/mobile` and uses the same pinned Node.js and pnpm
toolchain as the rest of the monorepo. Start it separately from the web and API
processes:

```bash
pnpm dev:mobile
```

The mobile client restores a secure Supabase session and sends its bearer token
through the platform-specific Apollo Client. Device networking, auth redirect
URLs, public mobile environment values, shared contract generation, project
boundaries, and validation commands are
documented in [Mobile](MOBILE.md) and
[`apps/mobile/README.md`](../apps/mobile/README.md).

## Continuous integration

Pull requests targeting `main` run the same formatting, linting, type, test,
build, E2E, and Docker checks from a clean GitHub-hosted runner. Run both
`pnpm check` and `pnpm test:ci` locally before pushing. Workflow behavior,
required branch checks, secrets, deployment gating, and rollback are documented
in [CI/CD](CI-CD.md).
