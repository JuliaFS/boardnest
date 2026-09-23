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

| Command             | Purpose                                |
| ------------------- | -------------------------------------- |
| `pnpm dev`          | Run web and API development processes  |
| `pnpm format`       | Format supported repository files      |
| `pnpm format:check` | Verify formatting without edits        |
| `pnpm lint`         | Run ESLint with zero warnings allowed  |
| `pnpm redis:up`     | Start and health-check local Redis     |
| `pnpm redis:logs`   | Follow local Redis container logs      |
| `pnpm redis:down`   | Stop the local Redis container         |
| `pnpm typecheck`    | Type-check every applicable workspace  |
| `pnpm test`         | Run workspace tests once               |
| `pnpm build`        | Produce application and package builds |
| `pnpm check`        | Run the complete local quality gate    |

Run `pnpm check` before opening a pull request.

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
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- `PORT`
- `CORS_ORIGIN`
- `NODE_ENV`

`SUPABASE_PUBLISHABLE_KEY` is deliberately public and is also used by the API client to support every Supabase signing-key mode. `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, and a production `REDIS_URL` containing credentials are secrets. Never prefix these secrets with `VITE_`, log them, commit them, or send them to a browser.

## Workspace conventions

- Use strict TypeScript and avoid `any`.
- Import types with `import type` when the import is type-only.
- Keep tests beside the source they verify.
- Add shared code only when at least two runtime boundaries truly share the concept.
- Keep domain logic out of React components and GraphQL resolver glue.
- Do not add infrastructure or dependencies before a concrete use case needs them.

## Git workflow

Use focused commits with Conventional Commit prefixes such as `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`, and `ci:`. Phase work should remain reviewable and must leave the quality gate green.

## Current local endpoints

- Web: `http://localhost:5173`
- API health: `http://localhost:4000/health`
- API session check: `http://localhost:4000/auth/me`
- API authentication callback: `http://localhost:4000/auth/callback`
- GraphQL HTTP endpoint: `http://localhost:4000/graphql`
- GraphQL WebSocket endpoint: `ws://localhost:4000/graphql`

Both transports use the same GraphQL schema and path. Queries and mutations use
HTTP; subscriptions use the `graphql-transport-ws` WebSocket protocol.
