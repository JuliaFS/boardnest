# Redis Pub/Sub

## Responsibility

Redis distributes live task events between Boardnest API instances. It does not
store task state, sessions, permissions, or an event history. PostgreSQL remains
the source of truth and GraphQL subscription resolvers continue to authorize
access through the user's RLS-aware data service.

```text
API instance A: successful task mutation
  -> PUBLISH boardnest:v1:task:<project-id>:<event-kind>
  -> Redis
  -> API instance B: subscribed event bus
  -> authorized GraphQL subscription
  -> WebSocket client
```

Channels are scoped by project and by `created`, `updated`, or `deleted` event
kind. The `v1` segment permits a future payload migration without mixing
incompatible consumers.

## Local development

The root `compose.yaml` starts an ephemeral Redis 8 service bound only to the
local machine:

```bash
pnpm redis:up
pnpm redis:logs
pnpm redis:down
```

The corresponding development configuration is:

```ini
REDIS_URL=redis://localhost:6379
```

No volume is required because Pub/Sub messages are not persisted. The full
Compose topology also builds and runs the API and static web services.

## Connections and lifecycle

The official `node-redis` client maintains two connections:

- a normal connection for `PUBLISH`;
- a duplicated, subscribe-only connection for `SUBSCRIBE` and `UNSUBSCRIBE`.

The API connects before listening for HTTP traffic and fails fast if Redis is
unavailable. On shutdown it completes local async iterators, unsubscribes their
listeners, and closes both connections.

If publishing fails after PostgreSQL has committed a mutation, the error is
logged without changing the successful mutation result. Reporting the mutation
as failed would encourage a duplicate retry even though the task was already
stored. Connected clients can reconcile from PostgreSQL after reconnecting.

## Delivery semantics

Redis Pub/Sub is at-most-once. An offline subscriber does not receive or replay
missed events. This is appropriate for live UI synchronization because the
board query provides the durable current state. A future requirement for
replayable domain processing should use an outbox and Redis Streams or another
durable broker instead of treating Pub/Sub as a queue.

## Production

Use a managed Redis provider and a TLS connection string where supported:

```ini
REDIS_URL=rediss://default:<password>@<host>:<port>
```

`REDIS_URL` is a server secret when it contains credentials. Store it in the
Railway environment, never prefix it with `VITE_`, never expose it to the
browser, and never commit it to Git.

## Troubleshooting

Check the local service:

```bash
docker compose ps redis
docker compose exec redis redis-cli ping
```

The expected response is `PONG`. If port `6379` is already in use, stop the
other local Redis process or change both the Compose port and `REDIS_URL`.
