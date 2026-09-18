begin;

-- Labels are scoped to a project to avoid cross-tenant or cross-project leakage.
create table public.labels (
  id uuid primary key default extensions.gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  name text not null,
  color text not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  constraint labels_id_project_unique unique (id, project_id),
  constraint labels_name_length_check
    check (char_length(btrim(name)) between 1 and 40),
  constraint labels_color_check
    check (color ~ '^#[0-9A-Fa-f]{6}$')
);

alter table public.labels enable row level security;

create unique index labels_project_name_unique_idx
  on public.labels (project_id, lower(name));

comment on table public.labels is
  'Reusable project-scoped task classification label.';

create trigger labels_set_updated_at
before update on public.labels
for each row execute function private.set_updated_at();

commit;
