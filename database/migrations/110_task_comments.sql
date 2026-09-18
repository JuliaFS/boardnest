begin;

-- Comments remain when an author account is deleted and display as deleted user.
create table public.task_comments (
  id uuid primary key default extensions.gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  edited_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  constraint task_comments_body_length_check
    check (char_length(btrim(body)) between 1 and 20000),
  constraint task_comments_edited_at_check
    check (edited_at is null or edited_at >= created_at)
);

alter table public.task_comments enable row level security;

create index task_comments_task_created_at_idx
  on public.task_comments (task_id, created_at, id);
create index task_comments_author_id_idx
  on public.task_comments (author_id)
  where author_id is not null;

comment on table public.task_comments is
  'User-authored discussion attached to a task.';

create trigger task_comments_set_updated_at
before update on public.task_comments
for each row execute function private.set_updated_at();

commit;
