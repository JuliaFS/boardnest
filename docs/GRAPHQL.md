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
user's JWT to Supabase. GraphQL request handling deliberately does not use the
service-role key, so RLS remains its resource-authorization boundary. The
separate background reminder scheduler uses that key only for its dedicated,
non-GraphQL RPC.

Subscriptions use the same `/graphql` path with the `graphql-transport-ws`
protocol. The WebSocket handshake carries the eligible `HttpOnly` access cookie;
browser JavaScript still cannot read the token. The server verifies the exact
origin and session before accepting the connection.

Workspace and project creation use separate insert and read requests. Their
membership rows are created by `AFTER INSERT` triggers, while their select
policies require that membership. Reading only after the insert transaction has
committed ensures the trigger-created membership is visible to the select RLS
check.

## Concepts

- The **schema** is the typed contract of object types, enums, inputs, queries,
  and mutations.
- A **query** reads data without an observable side effect.
- A **mutation** changes data and returns the affected resource or identifier.
- A **resolver** connects a schema field to application code.
- The **context** is created once per operation and carries the verified user
  and their RLS-aware data service.
- A **subscription** is a long-lived result stream that pushes selected changes
  to an authorized client without polling.

## Queries

| Query                     | Purpose                                              |
| ------------------------- | ---------------------------------------------------- |
| `currentUser`             | Return the verified session user                     |
| `workspaces`              | List accessible active workspaces                    |
| `workspace`               | Read one accessible workspace                        |
| `workspaceMembers`        | List the accessible workspace roster                 |
| `workspaceInvitations`    | List pending invitations for a managed workspace     |
| `projects`                | List accessible active projects by workspace         |
| `project`                 | Read one accessible project                          |
| `tasks`                   | List or search active project tasks                  |
| `task`                    | Read one accessible task                             |
| `taskStatuses`            | List ordered Kanban columns for a project            |
| `notifications`           | List the current user's notifications                |
| `notificationPreferences` | Read the current user's channel and event choices    |
| `workspaceSubscription`   | Read effective reminder capabilities for a workspace |
| `taskReminders`           | List authorized reminder schedules for a task        |
| `taskReminder`            | Read one authorized reminder schedule                |
| `activityFeed`            | List workspace or project activity                   |

List queries return `nodes` and `pageInfo`. `limit` is restricted to 1–100 and
`offset` cannot be negative. One extra row is fetched to derive `hasNextPage`.
Offset pagination is appropriate for the current data volume; cursor pagination is a future
option for large, frequently updated feeds.

## Mutations

The schema supports workspace and project creation, project update/deletion,
task creation/update/deletion/movement, task assignment, comments, invitations,
marking notifications as read, reminder lifecycle management, recipient
replacement, and notification preference updates. GraphQL enums map to the
lowercase values enforced by PostgreSQL.

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
SHA-256 hash, and returns the raw token once. `updateWorkspaceMemberRole`,
`removeWorkspaceMember`, and `revokeInvitation` manage the current workspace
roster and pending invitations. Owner creation, final-owner protection, admin
restrictions, and all authorization remain database-enforced. Email delivery
and invitation acceptance are outside the current browser workflow; see
[Members and invitations](MEMBERS.md).

### Reminder scheduling

`createTaskReminder` accepts one-time, weekly, monthly, quarterly, and yearly
schedules. A custom date uses `ONCE` with the selected UTC `nextRunAt`; the IANA
`timezone` preserves local recurrence intent. At least one channel and one
unique recipient are required. Recipients must be the task creator or an
assignee, and PostgreSQL enforces the workspace plan limits.

```graphql
mutation CreateReminder($input: CreateTaskReminderInput!) {
  createTaskReminder(input: $input) {
    id
    scheduleKind
    nextRunAt
    recipientIds
    status
  }
}
```

```json
{
  "input": {
    "taskId": "ae248328-e9e4-4416-a92d-47af95406e4d",
    "scheduleKind": "WEEKLY",
    "timezone": "Europe/Sofia",
    "nextRunAt": "2030-01-15T08:00:00.000Z",
    "inAppEnabled": true,
    "emailEnabled": false,
    "recipientIds": ["4ac60f36-9f7a-419f-b447-d8f9d2bc7cd8"]
  }
}
```

`pauseTaskReminder` releases active plan quota. `resumeTaskReminder` rechecks
the current plan before activation. Schedule fields are changed through
`updateTaskReminder`; recipient edits use
`replaceTaskReminderRecipients`; deletion is explicit. Reminder creation and
recipient replacement are atomic database functions. They explicitly authorize
the caller from the RLS-aware JWT before writing, and the existing plan, quota,
and recipient triggers remain authoritative.

`workspaceSubscription.plan` returns the effective capabilities used by the
database. For example, a past-due Pro subscription exposes Free capabilities,
while an anonymous workspace remains on Guest. This lets the future frontend
show limits without hardcoding them, but the database remains authoritative.

Plan and recipient validation errors are returned as `BAD_USER_INPUT`, while
authorization failures remain `FORBIDDEN`. This allows the UI to display clear
quota and email-entitlement messages without exposing unexpected database
details.

## Subscriptions

| Subscription  | Scope                     | Payload         |
| ------------- | ------------------------- | --------------- |
| `taskCreated` | One accessible project ID | Created task    |
| `taskUpdated` | One accessible project ID | Updated task    |
| `taskDeleted` | One accessible project ID | Deleted task ID |

Each subscription validates its project ID and reads that project through the
user's RLS-aware data service before joining the event stream. Task mutations
publish only after persistence succeeds. Direct database edits do not emit
application events.

The subscription resolvers depend on a small event-bus interface rather than a
Redis client. Production injects a Redis Pub/Sub implementation so mutations
and WebSocket clients can be handled by different API instances.

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

The current schema returns flat resources and has no per-row nested resolver, so
it does not currently create an N+1 query pattern. Adding DataLoader without a
batching use case would add unused abstraction. When fields such as
`Task.assignees` are added, loaders must be request-scoped and preserve RLS.

Apollo Client owns normalized browser cache state. The API does not cache
mutable authorization-sensitive rows. Redis provides event distribution, not
durable storage or an authorization boundary.

GraphQL fits Boardnest because dashboard, board, and detail screens need
different shapes of connected data, and subscriptions share the same schema.
REST remains appropriate for health checks, authentication redirects,
webhooks, downloads, and resources primarily relying on HTTP caching.
