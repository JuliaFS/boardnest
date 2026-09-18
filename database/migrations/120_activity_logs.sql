begin;

-- Append-only audit events retain entity IDs and snapshots in metadata.
create table public.activity_logs (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  actor_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),

  constraint activity_logs_event_type_check
    check (event_type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  constraint activity_logs_entity_type_check
    check (entity_type in ('workspace', 'member', 'project', 'task', 'comment', 'invitation')),
  constraint activity_logs_metadata_object_check
    check (jsonb_typeof(metadata) = 'object')
);

alter table public.activity_logs enable row level security;

create index activity_logs_workspace_created_at_idx
  on public.activity_logs (workspace_id, created_at desc, id);
create index activity_logs_project_created_at_idx
  on public.activity_logs (project_id, created_at desc)
  where project_id is not null;
create index activity_logs_task_created_at_idx
  on public.activity_logs (task_id, created_at desc)
  where task_id is not null;
create index activity_logs_actor_created_at_idx
  on public.activity_logs (actor_id, created_at desc)
  where actor_id is not null;

comment on table public.activity_logs is
  'Append-only workspace audit trail populated by trusted backend operations.';
comment on column public.activity_logs.metadata is
  'Event snapshot data needed after a referenced entity is renamed or deleted.';

commit;
