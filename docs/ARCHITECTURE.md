# Architecture

## Goals

Boardnest is a portfolio-grade, multi-tenant project management SaaS. The architecture favors explicit boundaries, testable business rules, and an evolutionary path from one API process to multiple instances without treating portfolio scope as enterprise scale.

## System context

```text
Browser
  ├─ Supabase Auth ──────────────> Supabase Auth
  └─ HTTP / WebSocket ───────────> Node.js GraphQL API
                                      ├─ SQL ─────> Supabase PostgreSQL
                                      └─ Pub/Sub ─> Redis
```

The browser uses Supabase for authentication and sends the resulting access token to the API. Business data goes through GraphQL. This creates one application authorization boundary and avoids coupling UI components directly to database tables.

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

Project membership can narrow access for private projects, but it cannot elevate a user's workspace role. The exact permission matrix will be approved before Phase 2 SQL.

### Authentication and authorization

Supabase Auth owns credentials and sessions. `auth.users` is not duplicated, and no password is stored by Boardnest. A public `profiles` row will reference the Auth user UUID.

The API will validate Supabase JWTs and enforce permissions at resolver/service boundaries. PostgreSQL RLS will provide defense in depth and safe access for any narrowly approved direct Supabase operations. The service-role key is server-only because it bypasses RLS.

### Data ownership

PostgreSQL is the source of truth. Redis carries ephemeral events and may later support rate limits or short-lived caches, but losing Redis must not lose persisted Boardnest data.

### Real-time delivery

A successful database mutation publishes a tenant-scoped event. Redis distributes it to every API instance, and GraphQL subscriptions deliver it to authorized connected clients. Authorization is checked when a subscription is established and when payloads are resolved.

## Runtime architecture

### Web

React and React Router will own navigation and local composition. Apollo Client will own GraphQL server state. React state will remain local by default; Zustand will be introduced only for genuinely global client-only state that does not belong in the URL or Apollo cache.

### API

The API starts as a modular monolith: one deployable service with feature-oriented modules and explicit internal boundaries. This keeps transactions and development straightforward while allowing individual modules to be extracted later if real scaling evidence appears.

The current Phase 1 HTTP health endpoint establishes deployability. Apollo Server and GraphQL modules arrive in Phase 4.

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

## Deferred decisions

Phase 2 will finalize the ERD, deletion behavior, task ordering strategy, invitation lifecycle, audit-event shape, RLS model, and whether projects are workspace-wide or can be private.
