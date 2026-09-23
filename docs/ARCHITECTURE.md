# Architecture

## Goals

Boardnest is a portfolio-grade, multi-tenant project management SaaS. The architecture favors explicit boundaries, testable business rules, and an evolutionary path from one API process to multiple instances without treating portfolio scope as enterprise scale.

## System context

```text
Browser ── HTTP-only session cookie ──> Node.js API
                                          ├─ Auth ───> Supabase Auth
                                          ├─ SQL ────> Supabase PostgreSQL
                                          └─ Pub/Sub > Redis
```

The browser uses the Node API as an authentication backend-for-frontend. The API exchanges credentials with Supabase Auth and keeps access and refresh tokens in `HttpOnly` cookies. Business data goes through GraphQL. This creates one application authorization boundary and avoids exposing tokens to browser JavaScript or coupling UI components directly to database tables.

## Repository boundaries

- `apps/web` owns browser rendering, routing, forms, accessibility, and Apollo client state.
- `apps/api` owns GraphQL, authentication context, authorization, validation, transactions, and event publication.
- `packages/shared` contains framework-independent values and utilities that genuinely apply on both sides. It must not depend on either application.
- `packages/graphql-types` will contain generated types, not a second handwritten domain model.
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

Supabase Auth owns credentials and sessions. `auth.users` is not duplicated, and no password is stored by Boardnest. A public `profiles` row references the Auth user UUID. The Node API owns the browser-facing login, registration, refresh, callback, and logout endpoints; session cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` outside local development.

The API validates Supabase JWTs, requires authentication at resolver boundaries,
and creates a request-scoped Supabase client carrying the user's JWT. PostgreSQL
RLS is the authoritative resource-authorization layer. The service-role key is
not used for normal GraphQL operations because it bypasses RLS.

### Data ownership

PostgreSQL is the source of truth. Redis carries ephemeral events and may later support rate limits or short-lived caches, but losing Redis must not lose persisted Boardnest data.

### Real-time delivery

A successful database mutation publishes a project-scoped event. GraphQL
subscriptions deliver it to connected clients only after the subscription has
verified access through the user's RLS-aware data service. Phase 7 uses an
in-memory event bus for one API process. Phase 8 will distribute those events
through Redis so the same contract works across multiple API instances.

## Runtime architecture

### Web

React and React Router will own navigation and local composition. Apollo Client will own GraphQL server state. React state will remain local by default; Zustand will be introduced only for genuinely global client-only state that does not belong in the URL or Apollo cache.

### API

The API starts as a modular monolith: one deployable service with feature-oriented modules and explicit internal boundaries. This keeps transactions and development straightforward while allowing individual modules to be extracted later if real scaling evidence appears.

Apollo Server 5 runs through Express 5 beside the health and authentication
routes. Resolvers validate input and delegate persistence to an RLS-aware data
service. Transport code does not duplicate database policy logic.

## Deployment topology

- Web: Vercel
- API and WebSocket process: Railway
- PostgreSQL and Auth: Supabase
- Redis: local Docker in development, managed Redis in production

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

## Phase 2 database decisions

Projects choose `workspace` or `private` visibility independently from the `planned`, `active`, `on_hold`, and `completed` business status. Archival uses a separate timestamp. Tasks use fractional positions, invitations store only token hashes, activity events keep JSON snapshots, and RLS helpers live in a non-exposed schema. Details are documented in `docs/DATABASE.md`.

## Phase 4 GraphQL decisions

Apollo uses Express instead of the standalone server because GraphQL shares one
HTTP process, cookie policy, CORS policy, and graceful shutdown lifecycle with
authentication. Context construction reuses Phase 3 session rotation. Queries
are bounded and flat; DataLoader will be introduced only when nested relation
resolvers create a real N+1 risk. See `docs/GRAPHQL.md`.

## Phase 5 frontend decisions

Apollo Client owns GraphQL server state and sends requests with `credentials:
include`, allowing the browser to attach the Phase 3 `HttpOnly` cookies without
making their values available to React. The Apollo cache is cleared at account
boundaries to prevent one user's cached records from appearing for the next
user in the same browser.

Protected application routes share one responsive layout. Route parameters own
resource identity, Apollo owns remote records, and React state is limited to
local interface concerns such as the mobile menu and workspace selector. The
foundation includes consistent loading, failure, missing-resource, and empty
states. See `docs/FRONTEND.md`.

## Phase 6 project and task workflow decisions

React Hook Form and Zod own client-side form mechanics and validation while the
API repeats authoritative validation at the trust boundary. Apollo mutations
refetch affected collection queries after create/delete operations and merge
entity updates through normalized IDs.

The Kanban board uses the current `@dnd-kit/react` API with its pointer and
keyboard sensors. Dragging updates local grouped task state immediately, then
persists only the moved task's status and fractional position. Failed mutations
restore the pre-drag snapshot. Reordering is disabled while search or priority
filters are active so hidden tasks cannot produce misleading positions.

## Phase 7 real-time decisions

The API serves HTTP GraphQL and the standard `graphql-transport-ws` protocol on
the same `/graphql` path. WebSocket authentication reuses the browser's
`HttpOnly` access cookie and rejects unexpected origins; no bearer token is made
available to frontend code. Apollo Client uses a split link so ordinary
operations retain HTTP semantics while subscriptions keep a lazy persistent
connection only when a board is active.

Task creation, update, movement, and deletion publish events only after a
successful database write. The board applies those payloads idempotently by
task ID and keeps optimistic drag-and-drop behavior. The process-local event
bus is deliberately isolated behind an interface because it cannot cross
process boundaries; Redis Pub/Sub replaces that implementation in Phase 8.
