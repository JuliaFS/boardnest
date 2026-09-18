begin;

-- Security-definer helpers live outside exposed schemas and break RLS recursion.
create function private.workspace_role(target_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select wm.role
  from public.workspace_members as wm
  where wm.workspace_id = target_workspace_id
    and wm.user_id = (select auth.uid())
$$;

create function private.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.workspace_members as wm
      where wm.workspace_id = target_workspace_id
        and wm.user_id = (select auth.uid())
    )
$$;

create function private.is_workspace_owner(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.workspace_role(target_workspace_id) = 'owner', false)
$$;

create function private.can_manage_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.workspace_role(target_workspace_id) in ('owner', 'admin'), false)
$$;

create function private.shares_workspace(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and (
      target_user_id = (select auth.uid())
      or exists (
        select 1
        from public.workspace_members as mine
        join public.workspace_members as theirs
          on theirs.workspace_id = mine.workspace_id
        where mine.user_id = (select auth.uid())
          and theirs.user_id = target_user_id
      )
    )
$$;

create function private.can_access_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.projects as p
      join public.workspace_members as wm
        on wm.workspace_id = p.workspace_id
       and wm.user_id = (select auth.uid())
      left join public.project_members as pm
        on pm.project_id = p.id
       and pm.user_id = (select auth.uid())
      where p.id = target_project_id
        and (
          p.visibility = 'workspace'
          or wm.role in ('owner', 'admin')
          or pm.user_id is not null
        )
    )
$$;

create function private.can_manage_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.projects as p
      join public.workspace_members as wm
        on wm.workspace_id = p.workspace_id
       and wm.user_id = (select auth.uid())
      left join public.project_members as pm
        on pm.project_id = p.id
       and pm.user_id = (select auth.uid())
      where p.id = target_project_id
        and (
          wm.role in ('owner', 'admin')
          or (wm.role = 'member' and pm.role = 'project_lead')
        )
    )
$$;

create function private.can_edit_project(target_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.projects as p
      join public.workspace_members as wm
        on wm.workspace_id = p.workspace_id
       and wm.user_id = (select auth.uid())
      left join public.project_members as pm
        on pm.project_id = p.id
       and pm.user_id = (select auth.uid())
      where p.id = target_project_id
        and (
          wm.role in ('owner', 'admin')
          or (
            wm.role = 'member'
            and (
              (p.visibility = 'workspace' and coalesce(pm.role, 'member') <> 'viewer')
              or (p.visibility = 'private' and pm.role in ('project_lead', 'member'))
            )
          )
        )
    )
$$;

create function private.task_project_id(target_task_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.project_id
  from public.tasks as t
  where t.id = target_task_id
$$;

create function private.can_access_task(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_access_project(private.task_project_id(target_task_id))
$$;

create function private.can_edit_task(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_edit_project(private.task_project_id(target_task_id))
$$;

create function private.can_manage_task(target_task_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_project(private.task_project_id(target_task_id))
$$;

revoke execute on all functions in schema private from public;

comment on function private.can_access_project(uuid) is
  'True for workspace-visible projects, explicit private-project members, and workspace owner/admin.';
comment on function private.can_edit_project(uuid) is
  'Applies the non-elevating combination of workspace and project roles.';

commit;
