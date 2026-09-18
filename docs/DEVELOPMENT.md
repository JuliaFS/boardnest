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
| `pnpm typecheck`    | Type-check every applicable workspace  |
| `pnpm test`         | Run workspace tests once               |
| `pnpm build`        | Produce application and package builds |
| `pnpm check`        | Run the complete local quality gate    |

Run `pnpm check` before opening a pull request.

## Environment setup

Copy `.env.example` to `.env`. Do not replace the committed example with real values.

### Browser-visible variables

Every `VITE_*` variable is bundled into frontend code and must be treated as public:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_GRAPHQL_URL`
- `VITE_WS_URL`

The Supabase anon key is designed to be public; its permissions must be constrained with RLS.

### Server-only variables

These values are read only by the API process:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- `PORT`
- `CORS_ORIGIN`
- `NODE_ENV`

`SUPABASE_SERVICE_ROLE_KEY` and `DATABASE_URL` are secrets. Never prefix either with `VITE_`, log them, commit them, or send them to a browser.

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

GraphQL and WebSocket endpoints are placeholders in `.env.example` until Phase 4 and Phase 7 respectively.
