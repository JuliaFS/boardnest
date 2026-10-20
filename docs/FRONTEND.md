# Frontend

## Responsibilities

`apps/web` owns routing, rendering, forms, accessible interaction, public
runtime configuration, and Apollo Client integration. It does not query
Supabase directly and cannot read authentication tokens.

The application provides:

- responsive authenticated navigation and route guards;
- registration, email-confirmation feedback, login, and logout;
- workspace and project browsing and creation;
- project visibility, lifecycle status, dates, editing, and deletion;
- project details and Kanban board pages;
- task creation, priority, due date, description, editing, and deletion;
- search and priority filtering;
- pointer and keyboard drag-and-drop with optimistic movement and rollback;
- live task create/update/delete synchronization through subscriptions;
- notification inbox, personal custom schedule create/edit/pause/resume/delete,
  event-specific delivery preferences, and email delivery history;
- workspace member rosters, role management, and pending invitations;
- project rosters with add, role-change, and removal controls;
- reusable loading, retryable error, empty, and not-found states.

## Data flow

```text
React page
   ↓ Apollo useQuery / useMutation
Apollo Client normalized cache
   ↓ POST /graphql with credentials: include
Browser attaches eligible HttpOnly cookies
   ↓
Boardnest API → Supabase PostgreSQL with user RLS
```

Apollo uses a split link for real-time data:

```text
task subscription → GraphQLWsLink → ws(s)://API/graphql
  → verified HttpOnly cookie + exact Origin
  → project authorization through RLS
  → Redis-distributed task event
  → immutable Kanban group update
```

Created and updated tasks are upserted by ID, so an initiating client does not
show duplicates when it receives its own event. Deleted tasks are removed from
all local columns. A disconnected subscription shows a warning; a normal board
query recovers durable state.

## State ownership

- Apollo Client owns GraphQL responses and normalized server state.
- React Router and URL parameters identify active resources.
- Component state owns local interaction such as dialogs, filters, and mobile
  navigation.
- `AuthProvider` owns the small browser-visible user/session state returned by
  the REST authentication BFF.
- React Hook Form owns form interaction and Zod owns client-side form schemas.
- Zustand is intentionally absent because there is no cross-cutting client-only
  state that justifies another store.

The Apollo cache is cleared on account boundaries so cached data from one user
cannot appear for the next user in the same browser.

## Kanban behavior

The board groups tasks by status and orders each group by fractional position.
Dragging changes local grouped state first and then persists the new status and
position. If the mutation fails, the board restores its pre-drag snapshot.

Reordering is disabled while search or priority filters are active because the
hidden cards make a visible insertion index ambiguous. Destructive project and
task actions require confirmation.

`@dnd-kit/react` supplies pointer and keyboard sensors. Buttons, labels,
dialogs, focusable controls, status messages, and responsive navigation are
covered by component or browser tests where they are part of the critical
workflow.

## Routes

| Route                                | Behavior                                                   |
| ------------------------------------ | ---------------------------------------------------------- |
| `/login`                             | Public login form                                          |
| `/register`                          | Public registration and confirmation flow                  |
| `/dashboard`                         | Workspace count and recent projects                        |
| `/workspaces/:workspaceId`           | Workspace details and accessible projects                  |
| `/projects`                          | Workspace selection, workspace creation, and project list  |
| `/projects/:projectId`               | Project details and management                             |
| `/projects/:projectId/board`         | Interactive real-time Kanban board                         |
| `/projects/:projectId/tasks/:taskId` | Task details and editing                                   |
| `/notifications`                     | Actionable notification inbox and schedule management      |
| `/members`                           | Workspace roster, roles, and pending invitation management |
| `/invite/:token`                     | Authenticated, email-matched invitation acceptance         |
| `/settings`                          | Reserved UI extension point for preferences                |

All application routes are protected. Anonymous visitors are redirected to
`/login`; authenticated users are redirected away from login and registration.

Project membership is managed from the project details page. See
[Members and invitations](MEMBERS.md) for the workspace invitation flow,
project roles, and access model.

Inbox entries are keyboard-accessible and open their related workspace,
project, or task after being marked as read. Payload routes are runtime
validated against an allowlist and must match the notification's structured
workspace, project, and task identifiers. Missing or rejected payload routes
fall back to the deepest valid structured context: task, project, then
workspace. Entries without any valid destination remain in the inbox and
expose a separate `Mark as read` action. The read state is updated
optimistically while the authenticated GraphQL mutation is in flight.

The main navigation reads `unreadNotificationCount` and displays an accessible
Notifications badge. The badge is hidden at zero, capped visually at `99+`, and
updated immediately through Apollo cache writes when an Inbox item is marked as
read. Mutation failures restore Apollo's optimistic state and trigger an exact
count refetch.

Until realtime notification subscriptions are introduced, the unread count is
polled every 30 seconds and refreshed on the browser `visibilitychange` event
when the document becomes visible. Both mechanisms reuse the authenticated
exact-count GraphQL query.

## Environment

The frontend requires three public build-time URLs:

- `VITE_API_URL` — authentication REST origin;
- `VITE_GRAPHQL_URL` — GraphQL HTTP endpoint;
- `VITE_WS_URL` — GraphQL WebSocket endpoint.

Vite embeds these values into the static JavaScript bundle. They must contain
real URLs rather than masked dashboard values. A production Vercel/Railway
deployment uses, for example:

```dotenv
VITE_API_URL=https://api.example.com
VITE_GRAPHQL_URL=https://api.example.com/graphql
VITE_WS_URL=wss://api.example.com/graphql
```

No service-role key, Redis URL, database URL, provider token, access token, or
refresh token may be placed in a `VITE_*` variable.

## Build and verification

```bash
pnpm --filter @boardnest/web typecheck
pnpm --filter @boardnest/web test
pnpm --filter @boardnest/web test:coverage
pnpm --filter @boardnest/web build
pnpm test:e2e
```

Production output is written to `apps/web/dist`. Vercel uses
`apps/web/vercel.json` for the pnpm install command, Vite build, output folder,
and React Router SPA rewrite.
