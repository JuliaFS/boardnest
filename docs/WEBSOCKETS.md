# WebSockets and GraphQL subscriptions

## Purpose

Boardnest uses GraphQL subscriptions to keep an open Kanban board synchronized
when another authenticated client creates, edits, moves, or deletes a task.
Queries and mutations continue to use HTTP because they are finite operations;
only subscriptions use WebSocket.

## Connection flow

```text
Protected board loads and refreshes the HTTP session
  -> Apollo lazily opens ws://localhost:4000/graphql
  -> browser attaches the HttpOnly access cookie
  -> API checks the exact Origin and verifies the Supabase session
  -> subscription resolver verifies project access through PostgreSQL RLS
  -> client joins a project-scoped task event stream
```

The protocol is `graphql-transport-ws`, implemented by `graphql-ws` on both
sides. The deprecated `subscriptions-transport-ws` protocol is not supported.

## Event lifecycle

The `createTask`, `updateTask`, `moveTask`, and `deleteTask` resolvers publish an
event only after the data service confirms the database operation. Events carry
the project ID for routing and either the current task or the deleted task ID.
The corresponding schema fields are:

- `taskCreated(projectId: ID!): Task!`
- `taskUpdated(projectId: ID!): Task!`
- `taskDeleted(projectId: ID!): DeletePayload!`

The frontend upserts create/update payloads and removes delete payloads. This is
idempotent, so a client receiving its own mutation event does not create a
duplicate card.

## Security

- Authentication remains in `HttpOnly` cookies; connection parameters contain
  no readable access token.
- The server rejects a WebSocket connection whose Origin is not the configured
  frontend origin.
- Every subscription requires a valid access cookie.
- Knowing a project UUID is insufficient: the resolver reads the project with
  the user's JWT, so workspace and private-project RLS policies still apply.
- Event topics use project IDs and never broadcast all task changes to every
  subscriber.

## Redis distribution

Phase 8 uses Redis Pub/Sub behind the event-bus boundary. A mutation handled by
one API process can therefore update a WebSocket connected to another process.
Events remain intentionally non-durable: PostgreSQL is the source of truth, and
reconnecting clients recover current state through the board query.

Direct changes made in Supabase SQL Editor do not pass through GraphQL mutations
and therefore do not publish a Phase 7 event.

## Manual verification

1. Start the application with `pnpm dev` and sign in.
2. Open the same project board in two browser windows using accounts that can
   access that project.
3. Create a task in the first window; it should appear in the second without a
   refresh.
4. Edit or move it; the second board should update its content or column.
5. Delete it; it should disappear from the second board.
6. Try subscribing as a user without project access; no project event stream
   should be established.

In browser DevTools, the Network panel shows one `/graphql` request with type
`websocket`. Its Messages view contains `connection_init`, `connection_ack`,
`subscribe`, and `next` protocol frames.
