begin;

-- Statuses are rows rather than an enum so each project can evolve its board.
create table public.task_statuses (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  category text not null,
  color text not null default '#64748B',
  position integer not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  constraint task_statuses_id_project_unique unique (id, project_id),
  constraint task_statuses_name_length_check
    check (char_length(btrim(name)) between 1 and 50),
  constraint task_statuses_category_check
    check (category in ('todo', 'in_progress', 'done')),
  constraint task_statuses_color_check
    check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint task_statuses_position_check
    check (position >= 0),
  constraint task_statuses_project_position_unique
    unique (project_id, position)
);

alter table public.task_statuses enable row level security;

create unique index task_statuses_project_name_unique_idx
  on public.task_statuses (project_id, lower(name));

comment on table public.task_statuses is
  'Project-specific Kanban columns; category supports stable analytics across custom names.';

create trigger task_statuses_set_updated_at
before update on public.task_statuses
for each row execute function private.set_updated_at();

create function private.add_default_task_statuses()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.task_statuses (project_id, name, category, color, position)
  values
    (new.id, 'Todo', 'todo', '#64748B', 1000),
    (new.id, 'In Progress', 'in_progress', '#3B82F6', 2000),
    (new.id, 'In Review', 'in_progress', '#8B5CF6', 3000),
    (new.id, 'Done', 'done', '#22C55E', 4000);
  return new;
end;
$$;

revoke execute on function private.add_default_task_statuses() from public;

create trigger projects_add_default_task_statuses
after insert on public.projects
for each row execute function private.add_default_task_statuses();

commit;
