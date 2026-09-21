# Boardnest

Boardnest is a collaborative project management platform for organizing workspaces, projects, and tasks through Kanban boards, role-based permissions, and real-time updates.

> Status: Phase 6 complete — workspace/project/task workflows, searchable Kanban boards, and accessible drag-and-drop task ordering.

## Planned features

- Supabase email/password authentication
- Multi-tenant workspaces with role-based access control
- Projects, tasks, labels, comments, and assignments
- Kanban boards with accessible drag and drop
- GraphQL queries, mutations, and subscriptions
- Real-time updates distributed through Redis Pub/Sub
- Activity history, notifications, search, and basic analytics

## Repository structure

```text
apps/
  api/                 Node.js API service
  web/                 React application
packages/
  config/              Shared project conventions
  graphql-types/       Generated GraphQL artifacts (Phase 4)
  shared/              Framework-independent shared code
database/
  migrations/          Ordered SQL migrations (Phase 2)
  seeds/               Development-only seed data (Phase 2)
docs/                  Architecture and development documentation
```

## Requirements

- Node.js 24.21.0 LTS
- pnpm 12.4.2

Using the pinned versions is recommended. The repository also declares compatible ranges in `package.json`.

## Local setup

```bash
corepack enable
corepack prepare pnpm@12.4.2 --activate
pnpm install
cp .env.example .env
pnpm dev
```

The web application runs on `http://localhost:5173`. The API health endpoint runs on `http://localhost:4000/health`. The protected session check is available at `http://localhost:4000/auth/me`, and GraphQL at `http://localhost:4000/graphql`.

## Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check
```

`pnpm check` runs formatting, linting, type checking, tests, and builds in sequence.

## Environment variables

Copy `.env.example` to `.env` for local development. The placeholder values are intentionally non-secret. Never commit `.env` files or a Supabase service-role key.

Variable ownership and security boundaries are documented in [Development](docs/DEVELOPMENT.md).

## Database

The schema will be SQL-first. Each table will have an ordered, independently readable migration under `database/migrations/`; SQL will not be embedded in application source files.

The Phase 2 schema is split into ordered migrations, with one file per table and separate files for shared functions, RLS, and grants. See [database/README.md](database/README.md) and [Supabase setup](docs/SUPABASE.md).

## Authentication

The browser sends credentials only to the Boardnest API. The API uses Supabase Auth and stores access and refresh tokens in `HttpOnly` cookies, so browser JavaScript cannot read them. See [Authentication](docs/AUTHENTICATION.md) for setup and manual verification.

## Frontend

The React application uses a responsive Tailwind CSS shell and Apollo Client for GraphQL server state. It includes protected routes, workspace/project browsing, notifications, and reusable loading, error, and empty states. See [Frontend](docs/FRONTEND.md) for route and state ownership details.

Phase 6 adds validated workspace, project, and task forms; project/task editing and deletion; Kanban filtering; and optimistic task movement persisted through GraphQL.

## Architecture

The system boundaries, dependency rules, multi-tenancy model, and security approach are described in [Architecture](docs/ARCHITECTURE.md).

### Architecture decisions

- **React** provides a component model and ecosystem suited to a complex, interactive Kanban UI.
- **TypeScript** gives the frontend, backend, and shared contracts one strict type system.
- **GraphQL and Apollo** provide the typed application API; subscriptions will add targeted real-time updates in Phase 7.
- **Node.js** lets the backend share language and selected types with the frontend while supporting HTTP and WebSocket workloads.
- **WebSockets** will deliver task and notification changes without polling.
- **Redis** will distribute subscription events between multiple API instances; it is not the source of truth.
- **Supabase** provides managed PostgreSQL and authentication while retaining a SQL-first data model.
- **Docker** will make the API and Redis development environment reproducible.
- **GitHub Actions** will enforce formatting, linting, type checking, tests, and builds before merge.
- **Vercel** fits the static Vite frontend, while **Railway** supports the long-running API and WebSocket process.

Detailed decision records and trade-offs live in [Architecture](docs/ARCHITECTURE.md).

## Delivery phases

1. Architecture and repository setup
2. Supabase database design and SQL migrations
3. Authentication
4. GraphQL backend
5. React application foundation
6. Projects, tasks, and Kanban
7. WebSockets and GraphQL subscriptions
8. Redis Pub/Sub
9. Testing expansion
10. Docker
11. CI/CD
12. Deployment
13. Documentation and cleanup

## License

[MIT](LICENSE)
