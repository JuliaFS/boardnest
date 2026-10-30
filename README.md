# Boardnest

Boardnest is a production-style, multi-tenant project management application
for organizing workspaces, projects, and tasks on collaborative Kanban boards.
It demonstrates a React and TypeScript frontend, an authenticated GraphQL API,
PostgreSQL Row Level Security, real-time WebSocket updates, Redis Pub/Sub, and
automated delivery to Vercel and Railway.

## Live application

- Web: <https://boardnest-web-omega.vercel.app>
- API health: <https://boardnest-api-production.up.railway.app/health>
- GraphQL: <https://boardnest-api-production.up.railway.app/graphql>

The hosted application uses free provider domains. Authentication therefore
requires cross-site `SameSite=None; Secure` cookies and may be blocked by strict
third-party-cookie browser settings. Same-site custom subdomains are the
recommended production topology.

## Screenshots

| Authentication                          | Project portfolio                  | Kanban board                             |
| --------------------------------------- | ---------------------------------- | ---------------------------------------- |
| _Add login and registration screenshot_ | _Add workspace/project screenshot_ | _Add board and drag-and-drop screenshot_ |

The placeholders intentionally keep repository documentation free of temporary
local screenshots. Add optimized production captures before using the project
in a portfolio presentation.

## Implemented features

- Supabase email/password registration, email confirmation through a PKCE
  callback, login, refresh, and logout;
- Turnstile-protected anonymous guest sessions with Redis admission limits and
  database-enforced demo quotas;
- access and refresh tokens stored only in secure `HttpOnly` cookies;
- multi-tenant workspaces with owner, admin, member, and viewer roles;
- explicit project rosters with project lead, member, and viewer roles;
- workspace-visible and private projects with independent lifecycle status;
- project and task creation, editing, deletion, dates, and priority;
- configurable Kanban statuses and pointer/keyboard drag-and-drop;
- optimistic task movement with rollback when persistence fails;
- task search and priority filtering;
- GraphQL queries, mutations, pagination, validation, and stable public errors;
- project-authorized GraphQL subscriptions for task creation, updates, moves,
  and deletion;
- Redis Pub/Sub distribution across API instances;
- PostgreSQL constraints, triggers, grants, and Row Level Security policies;
- notification and activity-feed API reads, task assignment, comments, and
  invitations delivered through configurable Resend or SMTP providers;
- task reminder delivery and user-owned custom notification schedule CRUD with
  workspace, project, or task context and plan-aware recurrence limits;
- a notification center for custom schedule creation and lifecycle management,
  event-specific channel preferences, and recipient-visible email status;
- atomic system notifications for membership, task, assignment, comment, and
  reminder activity;
- responsive protected routes with loading, error, empty, and missing-resource
  states;
- Vitest, React Testing Library, Playwright, coverage gates, Docker images,
  GitHub Actions CI, and protected production deployment.

## Current product scope

The portfolio release centers on authentication and the complete workspace →
project → Kanban task workflow. Workspace member management includes expiring
email invitations, authenticated acceptance, roles, and removal. The GraphQL
API and project details UI manage project-specific roles for existing workspace
members. The API also exposes assignments, comments, activity feeds, and
notification updates. PostgreSQL continues to enforce the documented
authorization rules independently of the UI.

## Architecture

```text
Browser (React + Apollo Client)
  ├── HTTPS + HttpOnly cookies ──> Node.js / Apollo API on Railway
  │                                  ├── Supabase Auth
  │                                  ├── Supabase PostgreSQL + RLS
  │                                  └── Upstash Redis Pub/Sub
  └── WSS GraphQL subscription ──> same Railway API process
```

PostgreSQL is the source of truth. Redis carries ephemeral real-time events,
and clients recover missed state through GraphQL queries after reconnecting.
The browser never receives a Supabase key or readable authentication token.

### Repository structure

```text
apps/
  api/                 Express, Apollo Server, auth, GraphQL, WebSockets
  mobile/              Expo, React Native, and Expo Router native client
  web/                 React, Vite, Apollo Client, forms, Kanban UI
packages/
  config/              Reserved shared configuration boundary
  graphql-types/       Reserved GraphQL code-generation boundary
  shared/              Runtime-independent shared code
database/
  migrations/          Ordered SQL schema, RLS, and grants
  tests/               Transactional SQL schema smoke test
docs/                  Architecture and operational documentation
.github/workflows/     CI and protected production deployment
```

See [Architecture](docs/ARCHITECTURE.md) for boundaries, data flow, ADRs, and
trade-offs.

## Technology stack

| Layer     | Technology                                                            |
| --------- | --------------------------------------------------------------------- |
| Web       | React 19, TypeScript, Vite, React Router, Apollo Client, Tailwind CSS |
| Mobile    | Expo 58, React Native 0.88, TypeScript, Expo Router                   |
| Forms/UI  | React Hook Form, Zod, `@dnd-kit/react`                                |
| API       | Node.js 24, Express 5, Apollo Server 5, GraphQL, `graphql-ws`         |
| Data/Auth | Supabase PostgreSQL, Supabase Auth, SQL-first migrations, RLS         |
| Real time | WebSockets, GraphQL subscriptions, Redis Pub/Sub                      |
| Testing   | Vitest, React Testing Library, Playwright                             |
| Delivery  | Docker, Docker Compose, GitHub Actions, Railway, Vercel, Upstash      |

## Local development

### Requirements

- Node.js 24.21.0
- pnpm 12.4.2
- Docker Engine with Docker Compose v2
- a configured Supabase project with the checked-in SQL migrations

### First setup

```bash
nvm install
nvm use
corepack enable
corepack prepare pnpm@12.4.2 --activate
pnpm install
cp .env.example .env
```

Replace the Supabase placeholders in `.env`, then start Redis and the two
development applications:

```bash
pnpm redis:up
pnpm dev
```

Open:

- web: <http://localhost:5174>
- API health: <http://localhost:4000/health>
- GraphQL HTTP: <http://localhost:4000/graphql>
- GraphQL WebSocket: `ws://localhost:4000/graphql`

`nvm install`, Corepack activation, and `pnpm install` are setup/update
commands. A normal development session needs only `nvm use`, `pnpm redis:up`,
and `pnpm dev` when dependencies are already installed.

The mobile foundation starts separately and does not require Redis or the API
until data integration is added:

```bash
pnpm dev:mobile
```

See [Mobile](docs/MOBILE.md) for its architecture and development boundary.

## Environment variables

Copy [.env.example](.env.example) to `.env`. Never commit the populated file.

| Variable                                    | Visibility           | Purpose                                       |
| ------------------------------------------- | -------------------- | --------------------------------------------- |
| `VITE_API_URL`                              | Public               | Browser authentication API origin             |
| `VITE_GRAPHQL_URL`                          | Public               | GraphQL HTTP endpoint                         |
| `VITE_WS_URL`                               | Public               | GraphQL WebSocket endpoint                    |
| `VITE_TURNSTILE_SITE_KEY`                   | Public               | Cloudflare Turnstile widget site key          |
| `API_URL`                                   | Server               | Public API origin used for Auth callback URLs |
| `COOKIE_SAME_SITE`                          | Server               | `lax` or production-only `none` cookie mode   |
| `SUPABASE_URL`                              | Server               | Supabase project URL                          |
| `SUPABASE_PUBLISHABLE_KEY`                  | Server               | Public key used by the API with user JWTs     |
| `REDIS_URL`                                 | Secret in production | Redis/Upstash protocol URL                    |
| `GUEST_RATE_LIMIT_SECRET`                   | Secret               | HMAC key for pseudonymous guest IP counters   |
| `CUSTOM_NOTIFICATION_SCHEDULER_ENABLED`     | Server               | Enables custom schedule processing            |
| `CUSTOM_NOTIFICATION_SCHEDULER_INTERVAL_MS` | Server               | Custom schedule polling interval              |
| `CUSTOM_NOTIFICATION_SCHEDULER_BATCH_SIZE`  | Server               | Maximum custom schedules claimed per poll     |
| `REMINDER_SCHEDULER_ENABLED`                | Server               | Enables background due-reminder processing    |
| `REMINDER_SCHEDULER_INTERVAL_MS`            | Server               | Scheduler polling interval                    |
| `REMINDER_SCHEDULER_BATCH_SIZE`             | Server               | Maximum reminders claimed per poll            |
| `EMAIL_DELIVERY_WORKER_ENABLED`             | Server               | Enables SMTP outbox delivery                  |
| `EMAIL_DELIVERY_WORKER_INTERVAL_MS`         | Server               | Email outbox polling interval                 |
| `EMAIL_DELIVERY_WORKER_BATCH_SIZE`          | Server               | Maximum email deliveries claimed per poll     |
| `SUPABASE_SERVICE_ROLE_KEY`                 | Secret               | Schedulers, worker, and account deletion key  |
| `TRUST_PROXY_HOPS`                          | Server               | Trusted reverse-proxy hop count               |
| `PORT`                                      | Server               | API listening port                            |
| `CORS_ORIGIN`                               | Server               | Exact trusted frontend origin                 |
| `NODE_ENV`                                  | Server               | `development`, `test`, or `production`        |

Values prefixed with `VITE_` are embedded into public JavaScript. Database
passwords, service-role keys, Redis credentials, and deployment tokens must
never use that prefix. The complete ownership model is in
[Development](docs/DEVELOPMENT.md) and [Security](docs/SECURITY.md).

## Database and Supabase

Run the SQL files in `database/migrations` exactly once and in filename order.
Each table has an independently readable migration; shared authorization
functions, RLS policies, and API grants are deliberately separate. Do not run
the destructive transactional smoke test against the hosted project.

- [Database migration order and ERD](database/README.md)
- [Table-level design](docs/DATABASE.md)
- [Supabase setup](docs/SUPABASE.md)

## Docker

After `.env` is configured:

```bash
pnpm docker:up
```

The containerized web application is served at <http://localhost:8080> and the
API at <http://localhost:4000>. Use `pnpm docker:logs` and
`pnpm docker:down` for lifecycle management. See [Docker](docs/DOCKER.md).

## Testing and quality

```bash
pnpm check
pnpm test:ci
docker compose config --quiet
docker build --check --target api-runtime .
```

`pnpm check` runs formatting, ESLint, TypeScript, unit/component tests,
application builds, and the Playwright browser workflow. Install Chromium once
with `pnpm exec playwright install chromium`. Coverage thresholds and opt-in
Redis/database integration checks are documented in [Testing](docs/TESTING.md).

## CI/CD and deployment

Pull requests and `main` run clean-install quality, E2E, Compose, and Docker
jobs. A successful `main` CI revision triggers the protected production
workflow, which deploys the API to Railway, builds/deploys the web app to
Vercel, and runs public smoke checks. Provider credentials are held by the
GitHub `production` environment, never by the application repository.

- [CI/CD](docs/CI-CD.md)
- [Production deployment and rollback](docs/DEPLOYMENT.md)

## Architecture decisions

- **React** supports a component-oriented, accessible, highly interactive UI.
- **TypeScript** provides one strict language across browser, server, and shared code.
- **GraphQL and Apollo** support screen-specific data shapes and typed subscriptions.
- **Node.js** serves HTTP and WebSockets in one long-running process.
- **WebSockets** update open boards without polling.
- **Redis** distributes ephemeral events between API instances without owning data.
- **Supabase** supplies managed PostgreSQL and Auth while preserving SQL and RLS visibility.
- **Docker** produces reproducible, non-root API and static-web runtime images.
- **GitHub Actions** makes quality checks and verified-revision deployment repeatable.
- **Vercel and Railway** match the static frontend and long-running WebSocket API workloads.

## Documentation

- [Public demo](docs/PUBLIC_DEMO.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Authentication](docs/AUTHENTICATION.md)
- [Database](docs/DATABASE.md)
- [Supabase](docs/SUPABASE.md)
- [GraphQL](docs/GRAPHQL.md)
- [Frontend](docs/FRONTEND.md)
- [Members and invitations](docs/MEMBERS.md)
- [Notifications](docs/NOTIFICATIONS.md)
- [Notification operations](docs/NOTIFICATION_OPERATIONS.md)
- [WebSockets](docs/WEBSOCKETS.md)
- [Redis](docs/REDIS.md)
- [Security](docs/SECURITY.md)
- [Testing](docs/TESTING.md)
- [Docker](docs/DOCKER.md)
- [Development](docs/DEVELOPMENT.md)
- [CI/CD](docs/CI-CD.md)
- [Deployment](docs/DEPLOYMENT.md)

## License

[MIT](LICENSE)
