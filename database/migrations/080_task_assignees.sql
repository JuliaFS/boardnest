begin;

-- A join table allows a task to have zero, one, or many assignees.
create table public.task_assignees (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default statement_timestamp(),

  primary key (task_id, user_id)
);

alter table public.task_assignees enable row level security;

create index task_assignees_user_id_idx
  on public.task_assignees (user_id, assigned_at desc);

comment on table public.task_assignees is
  'Many-to-many task assignments restricted to users who can access the project.';

create function private.validate_task_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_project_id uuid;
  target_workspace_id uuid;
  project_visibility text;
  workspace_role text;
begin
  select t.project_id, p.workspace_id, p.visibility
  into target_project_id, target_workspace_id, project_visibility
  from public.tasks as t
  join public.projects as p on p.id = t.project_id
  where t.id = new.task_id;

  if not found then
    raise exception 'Task does not exist'
      using errcode = '23503';
  end if;

  select wm.role
  into workspace_role
  from public.workspace_members as wm
  where wm.workspace_id = target_workspace_id
    and wm.user_id = new.user_id;

  if workspace_role is null then
    raise exception 'Task assignee must be a workspace member'
      using errcode = '23514';
  end if;

  if project_visibility = 'private'
    and workspace_role not in ('owner', 'admin')
    and not exists (
      select 1
      from public.project_members as pm
      where pm.project_id = target_project_id
        and pm.user_id = new.user_id
    )
  then
    raise exception 'Task assignee must have access to the private project'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke execute on function private.validate_task_assignee() from public;

create trigger task_assignees_validate_member
before insert or update on public.task_assignees
for each row execute function private.validate_task_assignee();

commit;
