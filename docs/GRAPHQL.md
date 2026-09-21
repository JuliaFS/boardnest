# GraphQL API

## Endpoint and request flow

Apollo Server 5 serves the application API at `http://localhost:4000/graphql`.
Its local landing page and introspection are enabled outside production.

```text
Browser + HttpOnly cookies
  -> exact Origin check and Apollo CSRF prevention
  -> verify or refresh the Supabase session
  -> request-scoped Supabase client with the user's JWT
  -> GraphQL and Zod validation
  -> parameterized PostgREST query
  -> PostgreSQL grants, constraints, and RLS
  -> GraphQL response
```

Browser requests must use `credentials: 'include'`. The browser never reads or
submits a bearer token. The API extracts the access token from its `HttpOnly`
cookie, rotates an expired session when possible, and passes the authenticated
user's JWT to Supabase. The service-role key is deliberately not used, so the
RLS policies installed in Phase 2 remain the resource-authorization boundary.

## Concepts

- The **schema** is the typed contract of object types, enums, inputs, queries,
  and mutations.
- A **query** reads data without an observable side effect.
- A **mutation** changes data and returns the affected resource or identifier.
- A **resolver** connects a schema field to application code.
- The **context** is created once per operation and carries the verified user
  and their RLS-aware data service.
- A **subscription** is a long-lived result stream. Subscriptions remain in
  Phase 7 because they require WebSocket lifecycle and authorization.

## Queries

| Query           | Purpose                                      |
| --------------- | -------------------------------------------- |
| `currentUser`   | Return the verified session user             |
| `workspaces`    | List accessible active workspaces            |
| `workspace`     | Read one accessible workspace                |
| `projects`      | List accessible active projects by workspace |
| `project`       | Read one accessible project                  |
| `tasks`         | List or search active project tasks          |
| `task`          | Read one accessible task                     |
| `taskStatuses`  | List ordered Kanban columns for a project    |
| `notifications` | List the current user's notifications        |
| `activityFeed`  | List workspace or project activity           |

List queries return `nodes` and `pageInfo`. `limit` is restricted to 1–100 and
`offset` cannot be negative. One extra row is fetched to derive `hasNextPage`.
Offset pagination is appropriate for this phase; cursor pagination is a future
option for large, frequently updated feeds.

## Mutations

The schema supports workspace and project creation, project update/deletion,
task creation/update/deletion/movement, task assignment, comments, invitations,
and marking notifications as read. GraphQL enums map to the lowercase values
enforced by PostgreSQL.

```graphql
mutation CreateProject($input: CreateProjectInput!) {
  createProject(input: $input) {
    id
    name
    visibility
    status
  }
}
```

```json
{
  "input": {
    "workspaceId": "6992c303-a240-4e15-8fcc-461d53756324",
    "name": "Product launch",
    "visibility": "PRIVATE",
    "status": "PLANNED"
  }
}
```

`inviteMember` generates a cryptographically random token, stores only its
SHA-256 hash, and returns the raw token once. Email delivery and invitation
acceptance will be connected when that frontend workflow is built.

## Authentication, authorization, and errors

`currentUser` is nullable so clients can check session state. Every other
resolver requires authentication and returns `UNAUTHENTICATED` when it is
missing. Authentication alone does not grant resource access: RLS evaluates
workspace membership, private-project membership, and roles for every query.

GraphQL validates operation shape and enums. Zod validates UUIDs, lengths,
dates, pagination, and non-empty update payloads. Database failures become
stable public error codes such as `FORBIDDEN`, `CONFLICT`, `NOT_FOUND`, and
`BAD_USER_INPUT`; unknown database details and stack traces are not exposed.

Security limits include:

- exact-origin checks for cookie-authenticated POST requests;
- Apollo CSRF prevention;
- a 100 KB JSON body limit;
- maximum operation depth of 10;
- list limits capped at 100;
- production introspection disabled;
- parameterized Supabase/PostgREST filters instead of SQL concatenation.

Rate limiting and weighted field cost should be added before exposing a public
production API. Depth limits address nested operations; field cost addresses
broad operations containing many aliases.

## N+1, caching, and transport choice

The Phase 4 schema returns flat resources and has no per-row nested resolver, so
it does not currently create an N+1 query pattern. Adding DataLoader without a
batching use case would add unused abstraction. When fields such as
`Task.assignees` are added, loaders must be request-scoped and preserve RLS.

Apollo Client will own normalized browser cache state in Phase 5. The API does
not cache mutable authorization-sensitive rows. Redis arrives in Phase 8 for
event distribution, not as the source of truth.

GraphQL fits Boardnest because dashboard, board, and detail screens need
different shapes of connected data, and subscriptions can later share the same
schema. REST remains appropriate for health checks, authentication redirects,
webhooks, downloads, and resources primarily relying on HTTP caching.
