# Architecture

## Goals

Boardnest is a portfolio-grade, multi-tenant project management SaaS. The architecture favors explicit boundaries, testable business rules, and an evolutionary path from one API process to multiple instances without treating portfolio scope as enterprise scale.

## System context

```text
Browser ── HTTP-only session cookie ──┐
                                      ├─> Node.js API ──> Supabase Auth/PostgreSQL
Mobile ── Supabase bearer token ──────┘        └────────> Redis
```

The browser uses the Node API as an authentication backend-for-frontend and
keeps tokens in `HttpOnly` cookies. Mobile stores its Supabase session in native
secure storage and presents the access token to the same API. Both transports
create the same RLS-aware GraphQL context.

## Repository boundaries

- `apps/web` owns browser rendering, routing, forms, accessibility, and Apollo client state.
- `apps/mobile` owns native rendering, Expo Router navigation, device lifecycle,
  and platform-specific interaction. It will use the same GraphQL business API
  without importing browser presentation code.
- `apps/api` owns GraphQL, authentication context, authorization, validation, transactions, and event publication.
- `packages/shared` contains framework-independent values and utilities that genuinely apply on both sides. It must not depend on either application.
- `packages/graphql-types` generates schema types and typed GraphQL documents
  from the API schema. Web and mobile may share operations from this package,
  while transport, authentication, and Apollo cache configuration remain
  platform-specific.
- `packages/config` is reserved for reusable configuration once duplication justifies extraction.
- `database` owns all PostgreSQL schema and seed SQL.

Applications may depend on packages. Packages must never depend on applications.

## Domain decisions

### Workspace is the tenant boundary

`workspace` is the canonical product term. We will not maintain duplicate `organization` and `workspace` concepts. Every project belongs to exactly one workspace, and data access is scoped through that relationship.

Initial workspace roles are:

- `owner`: lifecycle, billing-ready ownership, and all administration
- `admin`: membership and workspace administration except ownership transfer/deletion
- `member`: normal project and task collaboration
- `viewer`: read-only access

Project membership grants access to private projects and can narrow task-editing access, but it cannot elevate a user's workspace role. Workspace owners and admins always retain access to private projects. The complete matrix is documented in `docs/DATABASE.md`.

### Authentication and authorization

Supabase Auth owns credentials and sessions. `auth.users` is not duplicated, and no password is stored by Boardnest. A public `profiles` row references the Auth user UUID. The Node API owns the browser-facing cookie flow. The mobile Supabase client owns the native PKCE and refresh flow and persists session data through Expo SecureStore.

The API validates Supabase JWTs, requires authentication at resolver boundaries,
and creates a request-scoped Supabase client carrying the user's JWT. PostgreSQL
RLS is the authoritative resource-authorization layer. The service-role key is
not used for normal GraphQL operations because it bypasses RLS.

### Data ownership

PostgreSQL is the source of truth. Redis carries ephemeral events and may later support rate limits or short-lived caches, but losing Redis must not lose persisted Boardnest data.

### Real-time delivery

A successful database mutation publishes a versioned, project-scoped event.
Redis distributes it to every interested API instance, and GraphQL subscriptions
deliver it to connected clients only after the subscription verifies access
through the user's RLS-aware data service.

## Runtime architecture

### Web

React and React Router own navigation and local composition. Apollo Client owns
GraphQL server state. React state remains local by default; Zustand is added
only if genuinely global client-only state cannot belong in the URL or Apollo
cache.

### API

The API starts as a modular monolith: one deployable service with feature-oriented modules and explicit internal boundaries. This keeps transactions and development straightforward while allowing individual modules to be extracted later if real scaling evidence appears.

Apollo Server 5 runs through Express 5 beside the health and authentication
routes. Resolvers validate input and delegate persistence to an RLS-aware data
service. Transport code does not duplicate database policy logic.

### Mobile

Expo and React Native provide a separate native presentation boundary. Expo
Router owns file-based mobile navigation, while platform-independent GraphQL
contracts and domain helpers may be shared through workspace packages. Mobile
uses Supabase bearer sessions accepted by the same API; the browser's
HTTP-only cookie model remains unchanged. See [Mobile](MOBILE.md).

## Deployment topology

- Web: Vercel
- API and WebSocket process: Railway
- PostgreSQL and Auth: Supabase
- Redis: local Docker in development, managed Redis in production

The API process also hosts a lightweight reminder scheduler. PostgreSQL owns
claiming, idempotency, preference checks, recurrence, and schedule advancement
inside one transaction, so horizontally scaled API instances remain safe. The
Node timer only invokes the bounded service-role RPC. A second in-process worker
claims the resulting email outbox rows through lease-token RPCs and sends them
through the shared Nodemailer SMTP transport.

Canonical application events use the same durable boundary. A service-role-only
database function validates tenant context, resolves global and per-event user
preferences against effective plan capabilities, creates an idempotent in-app
notification, and queues entitled email work. Event production never performs
SMTP I/O inside the database transaction. See [Notifications](NOTIFICATIONS.md).

Membership, task, assignment, and comment tables use narrow PostgreSQL trigger
producers so source data and its canonical notification commit or roll back
together regardless of which authorized API path performs the write. Broadcast
events target current participants and exclude the actor. Direct membership and
assignment events target the affected account, while workspace removals target
remaining administrators because removal also purges the former member's
workspace-private notification history.

Email delivery is at-least-once. `FOR UPDATE SKIP LOCKED`, a five-minute stale
lease, a per-attempt lock token, stable SMTP `Message-ID`, and the existing
outbox idempotency key prevent normal duplicate processing while allowing
recovery after process failure. SMTP cannot guarantee exactly-once behavior if
the provider accepts a message but the success update cannot reach PostgreSQL.

Custom notification schedules are stored separately from task reminders
because they are personal and may target only a workspace or project. The API
owns their CRUD contract while PostgreSQL validates hierarchy, RLS, timezone,
channels, and plan limits. A separate API-hosted timer invokes the bounded,
service-role-only custom scheduler transaction; PostgreSQL owns occurrence
idempotency, channel masking, local-calendar recurrence, and atomic advancement.
The notification frontend reads email delivery status through the authenticated
GraphQL data service. Recipient identity is derived from the session rather
than browser input, and the database independently enforces it with RLS.

HTTPS terminates at the platform edge. Production WebSocket connections use WSS.

## Architecture decision records

### ADR-001: pnpm workspaces

**Problem:** Multiple applications and shared packages need consistent dependencies and commands.

**Decision:** Use pnpm workspaces with a single lockfile and a central version catalog.

**Trade-off:** Contributors need pnpm, but strict dependency isolation catches undeclared imports and the workspace remains lightweight.

### ADR-002: modular monolith backend

**Problem:** The domain needs clear separation without operational complexity that the current scale cannot justify.

**Decision:** Deploy one Node.js API organized by domain module.

**Trade-off:** Modules share a process and release cycle. This is acceptable while boundaries remain explicit and tests cover them.

### ADR-003: GraphQL as the business API

**Problem:** Dashboard, board, task detail, and real-time screens need overlapping but differently shaped data.

**Decision:** Use GraphQL for application data and subscriptions; retain conventional HTTP endpoints for operational health checks.

**Trade-off:** GraphQL requires complexity limits, DataLoader-style batching, careful authorization, and cache discipline. A simple public resource API would be better served by REST.

### ADR-004: SQL-first Supabase

**Problem:** The project must demonstrate PostgreSQL constraints, indexing, and RLS rather than hiding them behind an ORM.

**Decision:** Version plain SQL migrations and use parameterized database access without an ORM.

**Trade-off:** Mapping rows and composing queries require more deliberate code, but schema behavior stays visible and portable.

### ADR-005: server-state ownership

**Problem:** Duplicating server data in a client store causes synchronization bugs.

**Decision:** Apollo Client owns GraphQL data; URL state owns shareable filters; component state owns local interaction. Zustand requires a documented cross-cutting client-only use case before adoption.

**Trade-off:** State lives in several appropriate places rather than one universal store, so conventions must stay documented.

## Database decisions

Projects choose `workspace` or `private` visibility independently from the `planned`, `active`, `on_hold`, and `completed` business status. Archival uses a separate timestamp. Tasks use fractional positions, invitations store only token hashes, activity events keep JSON snapshots, and RLS helpers live in a non-exposed schema. Details are documented in `docs/DATABASE.md`.

## GraphQL decisions

Apollo uses Express instead of the standalone server because GraphQL shares one
HTTP process, cookie policy, CORS policy, and graceful shutdown lifecycle with
authentication. Context construction reuses the cookie-session rotation. Queries
are bounded and flat; DataLoader will be introduced only when nested relation
resolvers create a real N+1 risk. See `docs/GRAPHQL.md`.

## Frontend state decisions

Apollo Client owns GraphQL server state and sends requests with `credentials:
include`, allowing the browser to attach `HttpOnly` cookies without
making their values available to React. The Apollo cache is cleared at account
boundaries to prevent one user's cached records from appearing for the next
user in the same browser.

Protected application routes share one responsive layout. Route parameters own
resource identity, Apollo owns remote records, and React state is limited to
local interface concerns such as the mobile menu and workspace selector. The
foundation includes consistent loading, failure, missing-resource, and empty
states. See `docs/FRONTEND.md`.

## Project and task workflow decisions

React Hook Form and Zod own client-side form mechanics and validation while the
API repeats authoritative validation at the trust boundary. Apollo mutations
refetch affected collection queries after create/delete operations and merge
entity updates through normalized IDs.

The Kanban board uses the current `@dnd-kit/react` API with its pointer and
keyboard sensors. Dragging updates local grouped task state immediately, then
persists only the moved task's status and fractional position. Failed mutations
restore the pre-drag snapshot. Reordering is disabled while search or priority
filters are active so hidden tasks cannot produce misleading positions.

## Real-time decisions

The API serves HTTP GraphQL and the standard `graphql-transport-ws` protocol on
the same `/graphql` path. WebSocket authentication reuses the browser's
`HttpOnly` access cookie and rejects unexpected origins; no bearer token is made
available to frontend code. Apollo Client uses a split link so ordinary
operations retain HTTP semantics while subscriptions keep a lazy persistent
connection only when a board is active.

Task creation, update, movement, and deletion publish events only after a
successful database write. The board applies those payloads idempotently by
task ID and keeps optimistic drag-and-drop behavior. The process-local event
bus is deliberately isolated behind an interface; production injects the Redis
Pub/Sub implementation so events can cross process boundaries.

## Redis Pub/Sub decisions

The API uses the official `node-redis` client with separate publisher and
subscribe-only connections. Channels are versioned and scoped by project and
event kind, preventing every API instance from receiving unrelated tenant
traffic. JSON payloads are validated at both serialization and consumption
boundaries before reaching a WebSocket subscriber.

Redis Pub/Sub is deliberately ephemeral and at-most-once. A missed event is
recovered from PostgreSQL by the board query after reconnect; Redis never owns
task state. The API fails fast when its initial Redis connection cannot be
established. A later publish failure is logged but does not report a persisted
database mutation as failed. Graceful shutdown unsubscribes active iterators and
closes both Redis connections.

## Testing decisions

The test pyramid keeps fast domain and resolver checks in Vitest, renders
GraphQL-aware forms with React Testing Library and Apollo's `MockedProvider`,
and reserves Playwright for critical user journeys. Browser tests run the real
React application with a stateful transport fixture, while API integration
tests exercise the real HTTP and WebSocket servers. This avoids coupling the
default suite to hosted Supabase data without reducing transport coverage.

Coverage thresholds are baselines rather than vanity targets: they fail on
regression and can rise as the product adds behavior. Destructive PostgreSQL
RLS checks and live Redis checks remain explicit opt-in integration suites.

## Container decisions

One root multi-stage Dockerfile produces two independent runtime targets.
The API target contains compiled JavaScript and production-only dependencies;
the web target contains only static Vite assets served by an unprivileged Nginx
process. Build tools and source files do not enter either runtime image.

Compose models readiness rather than only process order: Redis must become
healthy before the API starts, and the API must become healthy before the web
container starts. Services communicate over the private Compose network;
only host-facing development ports are published. Supabase stays external
because it is the managed development and production database/auth provider.

## CI/CD decisions

CI and production delivery use separate GitHub Actions workflows so untrusted
pull-request code never enters a job with deployment credentials. The CI token
is read-only, installs the frozen lockfile on the pinned toolchain, and treats
formatting, linting, types, coverage, application builds, browser workflows,
Compose validation, and both Docker targets as merge gates.

Production delivery is downstream of a successful `main` CI run and resolves
the verified commit SHA. A protected GitHub `production` environment owns its
provider credentials and an explicit enable switch prevents accidental releases.
Deployment runs are
serialized; application rollback restores a previous healthy provider release,
while database changes use forward corrective migrations.

## Production deployment decisions

The production web application is a static Vite deployment on Vercel. The
long-running Railway service uses the root Dockerfile's final `api-runtime`
stage so HTTP and WebSocket traffic share one process. Supabase continues to
own PostgreSQL and authentication, while Upstash supplies a TLS Redis protocol
endpoint for cross-instance Pub/Sub.

The scheduler is disabled by default locally and enabled explicitly in
Railway. Its Supabase service-role credential is held only by the API service;
it is never sent to Vercel, GitHub build output, or the browser.

The preferred public URLs are same-site custom subdomains such as
`app.example.com` and `api.example.com`. This preserves `SameSite=Lax`
authentication cookies while exact CORS and WebSocket origin checks remain in
force. Provider domains on different sites are supported with production-only
`SameSite=None; Secure` cookies, but browser third-party-cookie policies make
that a temporary compatibility mode rather than the target architecture.

GitHub deploys only the exact `main` revision that passed CI. Runtime secrets
stay with their owning provider; GitHub holds scoped deployment credentials and
public smoke-test URLs. The post-deploy check covers the web document, API
health, and GraphQL/CORS path. Authenticated PKCE, RLS, and WebSocket behavior
remain explicit browser verification because they require a real user session.
