# Frontend

## Phase 5 foundation

Phase 5 establishes the React application foundation. It intentionally does
not include domain mutations or an interactive Kanban workflow.

The frontend currently provides:

- a responsive authenticated shell and navigation;
- protected routes for dashboard, workspaces, projects, boards, tasks,
  members, notifications, and settings;
- live workspace, project, task, and notification reads through GraphQL;
- reusable loading skeletons, error recovery, empty states, and not-found
  states;
- Apollo cache isolation when a user signs in, registers, or signs out;
- Tailwind CSS through the official Vite integration.

## Phase 6 workflows

Phase 6 builds on that foundation with:

- workspace and project creation from the Projects page;
- project visibility, lifecycle status, dates, editing, and deletion;
- task creation in a selected board column;
- task priority, due date, description, editing, and deletion;
- searchable and priority-filtered Kanban columns;
- pointer and keyboard drag-and-drop with optimistic feedback;
- fractional task positions, allowing one moved task to be persisted without
  renumbering an entire column;
- rollback to the pre-drag board when persistence fails.

Reordering is intentionally paused while filters are active because hidden
tasks make a visible index ambiguous. Project and task destructive actions use
explicit confirmation dialogs and rely on PostgreSQL cascade rules documented
in the database migrations.

## Data flow

```text
React page
   ↓ useQuery
Apollo Client cache
   ↓ cache miss / refresh
POST /graphql with credentials: include
   ↓ browser attaches HttpOnly cookies
Boardnest API → Supabase PostgreSQL with user RLS
```

The access and refresh token values remain unavailable to frontend JavaScript.
`credentials: include` instructs the browser to attach eligible cookies; it
does not expose their contents to Apollo Client.

## State ownership

- Apollo Client owns GraphQL responses and their normalized cache.
- React Router and URL parameters identify the active workspace, project, and
  task.
- Component state owns short-lived interface choices such as whether mobile
  navigation is open.
- Authentication user state remains in `AuthProvider` because login and logout
  use the dedicated REST BFF endpoints.
- Zustand is not installed because Phase 5 has no global client-only state that
  justifies another store.

## Routes

| Route                                | Phase 5 behavior                          |
| ------------------------------------ | ----------------------------------------- |
| `/dashboard`                         | Workspace and current-project overview    |
| `/workspaces/:workspaceId`           | Workspace details and accessible projects |
| `/projects`                          | Workspace selector and project list       |
| `/projects/:projectId`               | Project details                           |
| `/projects/:projectId/board`         | Board route and Phase 6 column foundation |
| `/projects/:projectId/tasks/:taskId` | Task details foundation                   |
| `/members`                           | Reserved collaboration route              |
| `/notifications`                     | Real notification query and empty state   |
| `/settings`                          | Reserved preferences route                |

All application routes sit behind `ProtectedRoute`. Anonymous visitors are
redirected to `/login`, while signed-in users cannot return to the login or
registration screens.

## Environment

The frontend reads these public build-time values:

- `VITE_API_URL` for authentication REST endpoints;
- `VITE_GRAPHQL_URL` for GraphQL over HTTP;
- `VITE_WS_URL` is reserved for Phase 7 subscriptions.

No service-role key or authentication token may be placed in a `VITE_*`
variable.
