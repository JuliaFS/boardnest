# Boardnest database

Boardnest uses a SQL-first PostgreSQL schema hosted by Supabase. Every table is defined in its own ordered migration. Cross-table functions, RLS policies, and grants are isolated in later migrations so dependencies remain explicit.

## Entity relationship map

```text
auth.users 1 ─── 1 profiles
                    │
                    ├──< workspace_members >── workspaces
                    │                              │
                    │                              ├──< invitations
                    │                              ├──< notifications
                    │                              ├──< activity_logs
                    │                              └──< projects
                    │                                     │
                    └──< project_members >────────────────┤
                                                          ├──< task_statuses
                                                          ├──< labels
                                                          └──< tasks
                                                                 │
                                                                 ├──< task_assignees >── profiles
                                                                 ├──< task_labels >────── labels
                                                                 ├──< task_comments
                                                                 ├──< activity_logs
                                                                 └──< notifications
```

`workspace_id` is the tenant boundary. Private project access is granted through `project_members`, except that workspace owners and admins always retain access.

## Migration order

Run every file exactly once and in filename order:

| Migration                         | Responsibility                                              |
| --------------------------------- | ----------------------------------------------------------- |
| `000_extensions.sql`              | PostgreSQL extension and private schemas                    |
| `001_common_functions.sql`        | Shared `updated_at` trigger function                        |
| `010_profiles.sql`                | Auth-linked profiles and signup trigger                     |
| `020_workspaces.sql`              | Tenant records                                              |
| `030_workspace_members.sql`       | Workspace roles and owner invariants                        |
| `040_projects.sql`                | Project visibility, status, and archival                    |
| `050_project_members.sql`         | Explicit private-project access                             |
| `060_task_statuses.sql`           | Configurable Kanban columns and defaults                    |
| `070_tasks.sql`                   | Tasks, priorities, ordering, and search index               |
| `080_task_assignees.sql`          | Multi-assignee relationship and access validation           |
| `090_labels.sql`                  | Project-scoped labels                                       |
| `100_task_labels.sql`             | Task-to-label relationship                                  |
| `110_task_comments.sql`           | Task discussion                                             |
| `120_activity_logs.sql`           | Append-only audit events                                    |
| `130_notifications.sql`           | Per-user notifications                                      |
| `140_invitations.sql`             | Hashed, expiring workspace invitations                      |
| `200_authorization_functions.sql` | Non-exposed RLS helper functions                            |
| `210_rls_policies.sql`            | Per-operation RLS policies                                  |
| `220_api_grants.sql`              | Explicit `anon`, `authenticated`, and `service_role` grants |

Do not run `database/tests/*.sql` as migrations. The smoke test inserts deterministic temporary records and rolls the transaction back.

## Project visibility and status

Visibility and status are independent:

- `visibility = workspace`: every workspace member can see the project.
- `visibility = private`: explicit project members can see it; workspace owner/admin always retain access.
- `status`: `planned`, `active`, `on_hold`, or `completed`.
- `archived_at`: removes a project from active views without overloading its business status.

A new project defaults to `workspace` visibility and `active` status. Its creator becomes `project_lead`, and the database creates Todo, In Progress, In Review, and Done task statuses automatically.

## Deletion behavior

- Deleting an Auth user cascades to the profile, but ownership restrictions require workspace ownership to be transferred first.
- Deleting a workspace cascades through all tenant-owned data.
- Deleting a project cascades through its operational data.
- Deleting a task cascades through assignments, labels, and comments.
- Deleted comment authors and activity actors become `NULL` so historical content remains meaningful.
- Projects and tasks normally use `archived_at`; hard deletion is reserved for explicit destructive actions.
- A trigger prevents removal or demotion of the last workspace owner.

## Migration rules

- Migrations are immutable after they have been applied to a shared environment.
- A schema change receives a new numbered file; an applied file is never edited.
- Table migrations own their keys, checks, indexes, timestamps, comments, and delete behavior.
- RLS is enabled immediately in every table migration, before policies are added.
- Raw invitation tokens and passwords are never persisted.
- Development seed data stays separate from production migrations.

See [Database design](../docs/DATABASE.md) for table-level details and [Supabase setup](../docs/SUPABASE.md) for execution instructions.
