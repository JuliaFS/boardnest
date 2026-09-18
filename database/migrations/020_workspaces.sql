begin;

-- A workspace is the top-level tenant and data-isolation boundary.
create table public.workspaces (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  slug text not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  constraint workspaces_name_length_check
    check (char_length(btrim(name)) between 1 and 100),
  constraint workspaces_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' and char_length(slug) between 3 and 63),
  constraint workspaces_archived_at_check
    check (archived_at is null or archived_at >= created_at)
);

alter table public.workspaces enable row level security;

create unique index workspaces_slug_unique_idx
  on public.workspaces (lower(slug));
create index workspaces_created_by_idx
  on public.workspaces (created_by);
create index workspaces_active_idx
  on public.workspaces (created_at desc)
  where archived_at is null;

comment on table public.workspaces is
  'Top-level Boardnest tenant containing members, projects, and related data.';

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function private.set_updated_at();

commit;
