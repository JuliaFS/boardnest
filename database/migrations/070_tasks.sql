begin;

-- Tasks belong to one project and one of that project's configurable statuses.
create table public.tasks (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  status_id uuid not null,
  title text not null,
  description text,
  priority text not null default 'medium',
  position numeric(20, 10) not null default 1000,
  created_by uuid references public.profiles (id) on delete set null,
  due_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  constraint tasks_id_project_unique unique (id, project_id),
  constraint tasks_status_project_fk
    foreign key (status_id, project_id)
    references public.task_statuses (id, project_id)
    on delete no action
    deferrable initially deferred,
  constraint tasks_title_length_check
    check (char_length(btrim(title)) between 1 and 240),
  constraint tasks_description_length_check
    check (description is null or char_length(description) <= 50000),
  constraint tasks_priority_check
    check (priority in ('none', 'low', 'medium', 'high', 'urgent')),
  constraint tasks_position_check
    check (position >= 0),
  constraint tasks_archived_at_check
    check (archived_at is null or archived_at >= created_at)
);

alter table public.tasks enable row level security;

create index tasks_project_status_position_idx
  on public.tasks (project_id, status_id, position, id)
  where archived_at is null;
create index tasks_project_priority_idx
  on public.tasks (project_id, priority, updated_at desc)
  where archived_at is null;
create index tasks_due_at_idx
  on public.tasks (due_at)
  where due_at is not null and archived_at is null;
create index tasks_created_by_idx
  on public.tasks (created_by)
  where created_by is not null;
create index tasks_search_idx
  on public.tasks using gin (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, ''))
  );

comment on table public.tasks is
  'Project work item positioned within a configurable Kanban status.';
comment on column public.tasks.position is
  'Fractional ordering value used to move a task without renumbering its whole column.';

create trigger tasks_set_updated_at
before update on public.tasks
for each row execute function private.set_updated_at();

commit;
