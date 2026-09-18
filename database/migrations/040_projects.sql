begin;

-- Visibility and lifecycle status are deliberately separate concepts.
create table public.projects (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  description text,
  visibility text not null default 'workspace',
  status text not null default 'active',
  created_by uuid not null references public.profiles (id) on delete restrict,
  start_date date,
  due_date date,
  archived_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  constraint projects_id_workspace_unique unique (id, workspace_id),
  constraint projects_name_length_check
    check (char_length(btrim(name)) between 1 and 120),
  constraint projects_description_length_check
    check (description is null or char_length(description) <= 10000),
  constraint projects_visibility_check
    check (visibility in ('workspace', 'private')),
  constraint projects_status_check
    check (status in ('planned', 'active', 'on_hold', 'completed')),
  constraint projects_date_range_check
    check (start_date is null or due_date is null or due_date >= start_date),
  constraint projects_archived_at_check
    check (archived_at is null or archived_at >= created_at)
);

alter table public.projects enable row level security;

create unique index projects_workspace_name_active_unique_idx
  on public.projects (workspace_id, lower(name))
  where archived_at is null;
create index projects_workspace_status_idx
  on public.projects (workspace_id, status, updated_at desc)
  where archived_at is null;
create index projects_created_by_idx
  on public.projects (created_by);

comment on table public.projects is
  'Workspace project with independently changeable visibility and workflow status.';
comment on column public.projects.visibility is
  'workspace is visible to all tenant members; private requires project membership except for workspace owner/admin.';
comment on column public.projects.status is
  'Business lifecycle state: planned, active, on_hold, or completed.';
comment on column public.projects.archived_at is
  'Separate from status so completed projects can remain visible before archival.';

create trigger projects_set_updated_at
before update on public.projects
for each row execute function private.set_updated_at();

create function private.protect_project_boundaries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.id, new.workspace_id, new.created_by)
    is distinct from (old.id, old.workspace_id, old.created_by)
  then
    raise exception 'Project identity, workspace, and creator cannot be changed'
      using errcode = '23514';
  end if;

  if new.visibility is distinct from old.visibility
    and (select auth.uid()) is not null
    and not exists (
      select 1
      from public.workspace_members as wm
      where wm.workspace_id = old.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role in ('owner', 'admin')
    )
  then
    raise exception 'Only workspace owners and admins can change project visibility'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

revoke execute on function private.protect_project_boundaries() from public;

create trigger projects_protect_boundaries
before update on public.projects
for each row execute function private.protect_project_boundaries();

commit;
