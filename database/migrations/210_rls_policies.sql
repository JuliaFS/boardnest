begin;

-- Profiles
create policy "profiles_select_shared_workspace"
on public.profiles for select to authenticated
using ((select private.shares_workspace(id)));

create policy "profiles_update_self"
on public.profiles for update to authenticated
using ((select auth.uid()) is not null and id = (select auth.uid()))
with check ((select auth.uid()) is not null and id = (select auth.uid()));

-- Workspaces
create policy "workspaces_select_member"
on public.workspaces for select to authenticated
using ((select private.is_workspace_member(id)));

create policy "workspaces_insert_creator"
on public.workspaces for insert to authenticated
with check ((select auth.uid()) is not null and created_by = (select auth.uid()));

create policy "workspaces_update_admin"
on public.workspaces for update to authenticated
using ((select private.can_manage_workspace(id)))
with check ((select private.can_manage_workspace(id)));

create policy "workspaces_delete_owner"
on public.workspaces for delete to authenticated
using ((select private.is_workspace_owner(id)));

-- Workspace members
create policy "workspace_members_select_member"
on public.workspace_members for select to authenticated
using ((select private.is_workspace_member(workspace_id)));

create policy "workspace_members_insert_admin"
on public.workspace_members for insert to authenticated
with check (
  (select private.can_manage_workspace(workspace_id))
  and (
    role <> 'owner'
    or (select private.is_workspace_owner(workspace_id))
  )
);

create policy "workspace_members_update_admin"
on public.workspace_members for update to authenticated
using ((select private.can_manage_workspace(workspace_id)))
with check (
  (select private.can_manage_workspace(workspace_id))
  and (
    role <> 'owner'
    or (select private.is_workspace_owner(workspace_id))
  )
);

create policy "workspace_members_delete_admin_or_self"
on public.workspace_members for delete to authenticated
using (
  (select private.can_manage_workspace(workspace_id))
  or user_id = (select auth.uid())
);

-- Projects
create policy "projects_select_with_access"
on public.projects for select to authenticated
using ((select private.can_access_project(id)));

create policy "projects_insert_workspace_contributor"
on public.projects for insert to authenticated
with check (
  (select auth.uid()) is not null
  and created_by = (select auth.uid())
  and (select private.workspace_role(workspace_id)) in ('owner', 'admin', 'member')
);

create policy "projects_update_manager"
on public.projects for update to authenticated
using ((select private.can_manage_project(id)))
with check ((select private.can_manage_project(id)));

create policy "projects_delete_workspace_admin"
on public.projects for delete to authenticated
using ((select private.can_manage_workspace(workspace_id)));

-- Project members
create policy "project_members_select_with_project_access"
on public.project_members for select to authenticated
using ((select private.can_access_project(project_id)));

create policy "project_members_insert_project_manager"
on public.project_members for insert to authenticated
with check ((select private.can_manage_project(project_id)));

create policy "project_members_update_project_manager"
on public.project_members for update to authenticated
using ((select private.can_manage_project(project_id)))
with check ((select private.can_manage_project(project_id)));

create policy "project_members_delete_project_manager"
on public.project_members for delete to authenticated
using ((select private.can_manage_project(project_id)));

-- Task statuses
create policy "task_statuses_select_with_project_access"
on public.task_statuses for select to authenticated
using ((select private.can_access_project(project_id)));

create policy "task_statuses_insert_project_manager"
on public.task_statuses for insert to authenticated
with check ((select private.can_manage_project(project_id)));

create policy "task_statuses_update_project_manager"
on public.task_statuses for update to authenticated
using ((select private.can_manage_project(project_id)))
with check ((select private.can_manage_project(project_id)));

create policy "task_statuses_delete_project_manager"
on public.task_statuses for delete to authenticated
using ((select private.can_manage_project(project_id)));

-- Tasks
create policy "tasks_select_with_project_access"
on public.tasks for select to authenticated
using ((select private.can_access_project(project_id)));

create policy "tasks_insert_project_contributor"
on public.tasks for insert to authenticated
with check (
  (select private.can_edit_project(project_id))
  and created_by = (select auth.uid())
);

create policy "tasks_update_project_contributor"
on public.tasks for update to authenticated
using ((select private.can_edit_project(project_id)))
with check ((select private.can_edit_project(project_id)));

create policy "tasks_delete_project_contributor"
on public.tasks for delete to authenticated
using ((select private.can_edit_project(project_id)));

-- Task assignees
create policy "task_assignees_select_with_task_access"
on public.task_assignees for select to authenticated
using ((select private.can_access_task(task_id)));

create policy "task_assignees_insert_task_contributor"
on public.task_assignees for insert to authenticated
with check (
  (select private.can_edit_task(task_id))
  and assigned_by = (select auth.uid())
);

create policy "task_assignees_delete_task_contributor"
on public.task_assignees for delete to authenticated
using ((select private.can_edit_task(task_id)));

-- Labels
create policy "labels_select_with_project_access"
on public.labels for select to authenticated
using ((select private.can_access_project(project_id)));

create policy "labels_insert_project_contributor"
on public.labels for insert to authenticated
with check ((select private.can_edit_project(project_id)));

create policy "labels_update_project_contributor"
on public.labels for update to authenticated
using ((select private.can_edit_project(project_id)))
with check ((select private.can_edit_project(project_id)));

create policy "labels_delete_project_contributor"
on public.labels for delete to authenticated
using ((select private.can_edit_project(project_id)));

-- Task labels
create policy "task_labels_select_with_task_access"
on public.task_labels for select to authenticated
using ((select private.can_access_task(task_id)));

create policy "task_labels_insert_task_contributor"
on public.task_labels for insert to authenticated
with check ((select private.can_edit_task(task_id)));

create policy "task_labels_delete_task_contributor"
on public.task_labels for delete to authenticated
using ((select private.can_edit_task(task_id)));

-- Task comments: every project viewer may comment; only author or project manager edits.
create policy "task_comments_select_with_task_access"
on public.task_comments for select to authenticated
using ((select private.can_access_task(task_id)));

create policy "task_comments_insert_project_viewer"
on public.task_comments for insert to authenticated
with check (
  (select private.can_access_task(task_id))
  and author_id = (select auth.uid())
);

create policy "task_comments_update_author_or_manager"
on public.task_comments for update to authenticated
using (
  author_id = (select auth.uid())
  or (select private.can_manage_task(task_id))
)
with check (
  author_id = (select auth.uid())
  or (select private.can_manage_task(task_id))
);

create policy "task_comments_delete_author_or_manager"
on public.task_comments for delete to authenticated
using (
  author_id = (select auth.uid())
  or (select private.can_manage_task(task_id))
);

-- Activity logs are append-only for authenticated clients.
create policy "activity_logs_select_with_scope_access"
on public.activity_logs for select to authenticated
using (
  case
    when project_id is null then (select private.is_workspace_member(workspace_id))
    else (select private.can_access_project(project_id))
  end
);

-- Notifications are private to their recipient.
create policy "notifications_select_recipient"
on public.notifications for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "notifications_update_recipient"
on public.notifications for update to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()))
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "notifications_delete_recipient"
on public.notifications for delete to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

-- Invitation acceptance is an API transaction; direct clients only administer invites.
create policy "invitations_select_workspace_admin"
on public.invitations for select to authenticated
using ((select private.can_manage_workspace(workspace_id)));

create policy "invitations_insert_workspace_admin"
on public.invitations for insert to authenticated
with check (
  (select private.can_manage_workspace(workspace_id))
  and invited_by = (select auth.uid())
);

create policy "invitations_update_workspace_admin"
on public.invitations for update to authenticated
using ((select private.can_manage_workspace(workspace_id)))
with check ((select private.can_manage_workspace(workspace_id)));

create policy "invitations_delete_workspace_admin"
on public.invitations for delete to authenticated
using ((select private.can_manage_workspace(workspace_id)));

commit;
