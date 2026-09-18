begin;

-- Explicit membership is required for ordinary users to access private projects.
create table public.project_members (
  project_id uuid not null,
  workspace_id uuid not null,
  user_id uuid not null,
  role text not null default 'member',
  joined_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  primary key (project_id, user_id),
  constraint project_members_project_workspace_fk
    foreign key (project_id, workspace_id)
    references public.projects (id, workspace_id)
    on delete cascade,
  constraint project_members_workspace_user_fk
    foreign key (workspace_id, user_id)
    references public.workspace_members (workspace_id, user_id)
    on delete cascade,
  constraint project_members_role_check
    check (role in ('project_lead', 'member', 'viewer'))
);

alter table public.project_members enable row level security;

create index project_members_user_id_idx
  on public.project_members (user_id, project_id);
create index project_members_workspace_id_idx
  on public.project_members (workspace_id, user_id);

comment on table public.project_members is
  'Project-specific membership and role, primarily used by private projects.';

create trigger project_members_set_updated_at
before update on public.project_members
for each row execute function private.set_updated_at();

create function private.add_project_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.project_members (project_id, workspace_id, user_id, role)
  values (new.id, new.workspace_id, new.created_by, 'project_lead');
  return new;
end;
$$;

revoke execute on function private.add_project_creator() from public;

create trigger projects_add_creator
after insert on public.projects
for each row execute function private.add_project_creator();

commit;
