# Docker

## Purpose

Docker packages an application and its runtime dependencies into an image. A
container is a running instance of that image. Boardnest uses one multi-stage
`Dockerfile` to produce separate API and web images, while Docker Compose
defines how those images run together with Redis.

Supabase PostgreSQL and Auth remain managed external services. They are not
duplicated in this stack, which avoids a second database configuration with
different authentication and RLS behavior.

## Core concepts

- **Image:** immutable filesystem and startup configuration created by
  `docker build`.
- **Container:** isolated running process created from an image.
- **Dockerfile:** reproducible instructions for building images.
- **Build stage:** temporary image layer used for dependency installation or
  compilation. Multi-stage builds keep these tools out of runtime images.
- **Docker Compose:** declarative configuration for related services, networks,
  environment variables, health checks, and startup dependencies.
- **Network:** private DNS-enabled network where the API reaches Redis through
  `redis://redis:6379`.
- **Volume:** persistent storage managed outside a container's writable layer.
  Boardnest deliberately has no Redis volume because Pub/Sub messages are
  ephemeral and PostgreSQL is the source of truth.

## Image architecture

The root `Dockerfile` exposes two final targets:

### `api-runtime`

1. Pins Node.js 24.21.0 and pnpm 12.4.2.
2. Installs dependencies from the frozen lockfile.
3. Compiles the TypeScript API.
4. Deploys only production dependencies and API output.
5. Runs as the existing non-root `node` user.
6. Exposes port `4000` and checks `/health`.

### `web-runtime`

1. Builds the Vite application with public `VITE_*` build arguments.
2. Copies only static assets into Nginx.
3. Runs Nginx as its non-root `nginx` user on port `8080`.
4. Provides SPA fallback through `try_files`.
5. Serves hashed assets with immutable caching and checks `/health`.

Dependency installation uses the frozen workspace lockfile. Build caches remain
builder-managed and are never copied into a final runtime image. The Dockerfile
avoids a named cache mount because Railway requires provider-specific cache IDs.

## Prerequisites

- Docker Engine
- Docker Compose v2
- a configured Boardnest Supabase project
- real `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY` values in the root
  `.env`

Verify Docker:

```bash
docker --version
docker compose version
```

## First run

Validate the resolved Compose file without starting containers:

```bash
pnpm docker:config
```

Build and start the stack:

```bash
pnpm docker:up
```

`--wait` returns only after all three services are healthy.

Open:

- web: `http://localhost:8080`
- API health: `http://localhost:4000/health`
- GraphQL HTTP: `http://localhost:4000/graphql`
- GraphQL WebSocket: `ws://localhost:4000/graphql`

Inspect service state:

```bash
docker compose ps
```

Follow logs:

```bash
pnpm docker:logs
```

Stop and remove containers plus the Compose network:

```bash
pnpm docker:down
```

There is no Redis data volume to remove.

## Development workflows

Use one of these workflows at a time:

### Fast source development

```bash
pnpm redis:up
pnpm dev
```

This uses Vite hot reload at `http://localhost:5174 ` and the API watcher.

### Container verification

```bash
pnpm docker:up
```

This uses compiled application output and Nginx at
`http://localhost:8080`. Rebuild after source changes:

```bash
pnpm docker:build
pnpm docker:up
```

Do not run both workflows with their default ports at the same time.

## Environment variables

Compose reads root `.env` for interpolation and passes only the API values it
uses. Secrets are never copied into the Dockerfile or image layers.

Server runtime variables:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `API_URL`
- `CORS_ORIGIN`
- `REDIS_URL`
- `PORT`
- `NODE_ENV`

Browser variables are build arguments because Vite embeds them in static
JavaScript:

- `VITE_API_URL`
- `VITE_GRAPHQL_URL`
- `VITE_WS_URL`

The `DOCKER_PUBLIC_*` values in `.env` feed those build arguments. They must
never contain secrets. Changing them requires rebuilding the web image.

For local HTTP, Compose defaults `DOCKER_NODE_ENV=development` so authentication
cookies are not marked `Secure`. A production deployment must use
`NODE_ENV=production`, HTTPS URLs, and an exact HTTPS CORS origin.

## Port overrides

Default host ports are:

| Service | Host | Container |
| ------- | ---- | --------- |
| web     | 8080 | 8080      |
| API     | 4000 | 4000      |
| Redis   | 6379 | 6379      |

If a port is occupied, change the corresponding values in `.env`:

```ini
WEB_HOST_PORT=8180
API_HOST_PORT=4100
REDIS_HOST_PORT=6380

DOCKER_API_URL=http://localhost:4100
DOCKER_WEB_ORIGIN=http://localhost:8180
DOCKER_PUBLIC_API_URL=http://localhost:4100
DOCKER_PUBLIC_GRAPHQL_URL=http://localhost:4100/graphql
DOCKER_PUBLIC_WS_URL=ws://localhost:4100/graphql
```

Rebuild after changing public URLs:

```bash
pnpm docker:up
```

## Health checks and startup order

Redis is healthy only after `redis-cli ping` succeeds. The API starts after
Redis is healthy and reports healthy only after `GET /health` succeeds. The
web container starts after the API is healthy and has its own Nginx health
endpoint.

This avoids treating a started process as a ready dependency.

## Security properties

- runtime processes use non-root users;
- API and web filesystems are read-only with a temporary `/tmp`;
- `no-new-privileges` is enabled;
- images receive no `.env`, Git history, tests, coverage, or local
  `node_modules`;
- API secrets are runtime environment values, not build arguments;
- published ports bind to `127.0.0.1` for local-only access;
- Redis persistence is disabled because it carries transient events only.

## Troubleshooting

### A port is already in use

Stop `pnpm dev` before starting Compose, or use the documented port
overrides. Find listeners with:

```bash
lsof -iTCP:4000 -sTCP:LISTEN -n -P
lsof -iTCP:8080 -sTCP:LISTEN -n -P
```

### API is unhealthy

```bash
docker compose logs api redis
docker compose ps
```

Check the Supabase values and confirm Redis is healthy.

### Frontend uses an old API URL

Vite variables are embedded at build time. Update `DOCKER_PUBLIC_*` and run:

```bash
docker compose build --no-cache web
docker compose up -d --wait web
```

### Authentication is rejected by CORS

`DOCKER_WEB_ORIGIN` must exactly match the browser origin, including scheme
and port. Supabase authentication redirect URLs must include
`DOCKER_API_URL/auth/callback`.

## Production considerations

Compose is a local verification environment, not the final deployment
topology. The planned production layout remains:

- Vercel for the web build;
- Railway for the long-running API and WebSocket server;
- Upstash Redis for managed Pub/Sub;
- Supabase for PostgreSQL and Auth.

Production must use HTTPS/WSS URLs, `NODE_ENV=production`, platform-managed
secrets, an exact frontend CORS origin, health probes, log aggregation, and
resource limits. Never bake credentials into an image or pass secrets through
Vite build arguments.
