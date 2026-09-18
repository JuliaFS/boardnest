begin;

-- Explicit grants complement RLS. Anonymous clients receive no business data.
revoke all on table
  public.profiles,
  public.workspaces,
  public.workspace_members,
  public.projects,
  public.project_members,
  public.task_statuses,
  public.tasks,
  public.task_assignees,
  public.labels,
  public.task_labels,
  public.task_comments,
  public.activity_logs,
  public.notifications,
  public.invitations
from anon, authenticated;

grant select on table
  public.profiles,
  public.workspaces,
  public.workspace_members,
  public.projects,
  public.project_members,
  public.task_statuses,
  public.tasks,
  public.task_assignees,
  public.labels,
  public.task_labels,
  public.task_comments,
  public.activity_logs,
  public.notifications
to authenticated;

grant select (
  id,
  workspace_id,
  email,
  role,
  status,
  invited_by,
  accepted_by,
  expires_at,
  accepted_at,
  revoked_at,
  created_at,
  updated_at
) on public.invitations to authenticated;

grant insert on public.workspaces to authenticated;
grant update (display_name, avatar_url, timezone) on public.profiles to authenticated;
grant update (name, slug, archived_at) on public.workspaces to authenticated;
grant delete on public.workspaces to authenticated;

grant insert, delete on public.workspace_members to authenticated;
grant update (role) on public.workspace_members to authenticated;

grant insert, delete on public.projects to authenticated;
grant update (name, description, visibility, status, start_date, due_date, archived_at)
  on public.projects to authenticated;

grant insert, delete on public.project_members to authenticated;
grant update (role) on public.project_members to authenticated;

grant insert, delete on public.task_statuses to authenticated;
grant update (name, category, color, position) on public.task_statuses to authenticated;

grant insert, delete on public.tasks to authenticated;
grant update (status_id, title, description, priority, position, due_at, archived_at)
  on public.tasks to authenticated;

grant insert, delete on public.task_assignees to authenticated;

grant insert, delete on public.labels to authenticated;
grant update (name, color) on public.labels to authenticated;

grant insert, delete on public.task_labels to authenticated;

grant insert, delete on public.task_comments to authenticated;
grant update (body, edited_at) on public.task_comments to authenticated;

grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;

grant insert, delete on public.invitations to authenticated;
grant update (role, status, accepted_by, expires_at, accepted_at, revoked_at)
  on public.invitations to authenticated;

grant usage on schema private to authenticated;
grant usage on schema extensions to authenticated, service_role;
grant execute on function private.workspace_role(uuid) to authenticated;
grant execute on function private.is_workspace_member(uuid) to authenticated;
grant execute on function private.is_workspace_owner(uuid) to authenticated;
grant execute on function private.can_manage_workspace(uuid) to authenticated;
grant execute on function private.shares_workspace(uuid) to authenticated;
grant execute on function private.can_access_project(uuid) to authenticated;
grant execute on function private.can_manage_project(uuid) to authenticated;
grant execute on function private.can_edit_project(uuid) to authenticated;
grant execute on function private.task_project_id(uuid) to authenticated;
grant execute on function private.can_access_task(uuid) to authenticated;
grant execute on function private.can_edit_task(uuid) to authenticated;
grant execute on function private.can_manage_task(uuid) to authenticated;

grant usage on schema public, private, extensions to service_role;
grant select, insert, update, delete on table
  public.profiles,
  public.workspaces,
  public.workspace_members,
  public.projects,
  public.project_members,
  public.task_statuses,
  public.tasks,
  public.task_assignees,
  public.labels,
  public.task_labels,
  public.task_comments,
  public.activity_logs,
  public.notifications,
  public.invitations
to service_role;

commit;
