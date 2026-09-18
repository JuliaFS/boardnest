begin;

-- project_id in this join table enforces that task and label share a project.
create table public.task_labels (
  task_id uuid not null,
  label_id uuid not null,
  project_id uuid not null,
  created_at timestamptz not null default statement_timestamp(),

  primary key (task_id, label_id),
  constraint task_labels_task_project_fk
    foreign key (task_id, project_id)
    references public.tasks (id, project_id)
    on delete cascade,
  constraint task_labels_label_project_fk
    foreign key (label_id, project_id)
    references public.labels (id, project_id)
    on delete cascade
);

alter table public.task_labels enable row level security;

create index task_labels_label_id_idx
  on public.task_labels (label_id, task_id);
create index task_labels_project_id_idx
  on public.task_labels (project_id, task_id);

comment on table public.task_labels is
  'Many-to-many task labels with database-enforced project consistency.';

commit;
