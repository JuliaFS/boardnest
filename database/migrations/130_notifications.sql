begin;

-- Notifications are private to one recipient and can reference project context.
create table public.notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  task_id uuid references public.tasks (id) on delete set null,
  type text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),

  constraint notifications_type_check
    check (type ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$'),
  constraint notifications_title_length_check
    check (char_length(btrim(title)) between 1 and 160),
  constraint notifications_body_length_check
    check (body is null or char_length(body) <= 2000),
  constraint notifications_payload_object_check
    check (jsonb_typeof(payload) = 'object'),
  constraint notifications_read_at_check
    check (read_at is null or read_at >= created_at)
);

alter table public.notifications enable row level security;

create index notifications_user_unread_idx
  on public.notifications (user_id, created_at desc)
  where read_at is null;
create index notifications_user_created_at_idx
  on public.notifications (user_id, created_at desc, id);

comment on table public.notifications is
  'Private, per-user application notifications created by trusted backend operations.';

commit;
