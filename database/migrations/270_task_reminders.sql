begin;

-- A reminder owns one schedule and one or more task-related recipients.
create table public.task_reminders (
  id uuid primary key default extensions.gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  project_id uuid not null references public.projects (id) on delete cascade,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  created_by uuid not null references public.profiles (id) on delete cascade,
  schedule_kind text not null,
  timezone text not null default 'UTC',
  next_run_at timestamptz not null,
  ends_at timestamptz,
  last_run_at timestamptz,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  stop_when_completed boolean not null default true,
  status text not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  constraint task_reminders_task_project_fk
    foreign key (task_id, project_id)
    references public.tasks (id, project_id)
    on delete cascade,
  constraint task_reminders_project_workspace_fk
    foreign key (project_id, workspace_id)
    references public.projects (id, workspace_id)
    on delete cascade,
  constraint task_reminders_schedule_kind_check
    check (schedule_kind in ('once', 'weekly', 'monthly', 'quarterly', 'yearly')),
  constraint task_reminders_timezone_length_check
    check (char_length(btrim(timezone)) between 1 and 100),
  constraint task_reminders_channel_check
    check (in_app_enabled or email_enabled),
  constraint task_reminders_status_check
    check (status in ('active', 'paused', 'completed', 'canceled')),
  constraint task_reminders_end_check
    check (ends_at is null or ends_at > next_run_at),
  constraint task_reminders_last_run_check
    check (last_run_at is null or last_run_at >= created_at)
);

alter table public.task_reminders enable row level security;

create index task_reminders_due_idx
  on public.task_reminders (next_run_at, id)
  where status = 'active';
create index task_reminders_workspace_active_task_idx
  on public.task_reminders (workspace_id, task_id)
  where status = 'active';
create index task_reminders_task_created_idx
  on public.task_reminders (task_id, created_at desc);
create index task_reminders_creator_idx
  on public.task_reminders (created_by, created_at desc);

create table public.task_reminder_recipients (
  reminder_id uuid not null references public.task_reminders (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default statement_timestamp(),

  primary key (reminder_id, user_id)
);

alter table public.task_reminder_recipients enable row level security;

create index task_reminder_recipients_user_idx
  on public.task_reminder_recipients (user_id, created_at desc);

create function private.effective_workspace_plan(target_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when ws.plan_code = 'guest' then 'guest'
    when ws.status in ('active', 'trialing') then ws.plan_code
    else 'free'
  end
  from public.workspace_subscriptions as ws
  where ws.workspace_id = target_workspace_id
$$;

create function private.set_task_reminder_context_and_enforce_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  task_project_id uuid;
  task_workspace_id uuid;
  task_creator_id uuid;
  effective_plan text;
  plan_limits public.subscription_plans%rowtype;
  active_reminders_for_task integer;
  active_reminder_tasks integer;
begin
  select t.project_id, p.workspace_id, t.created_by
  into task_project_id, task_workspace_id, task_creator_id
  from public.tasks as t
  join public.projects as p on p.id = t.project_id
  where t.id = new.task_id;

  if not found then
    raise exception 'Reminder task does not exist'
      using errcode = '23503';
  end if;

  if tg_op = 'UPDATE'
    and (new.id, new.task_id, new.project_id, new.workspace_id, new.created_by)
      is distinct from (old.id, old.task_id, old.project_id, old.workspace_id, old.created_by)
  then
    raise exception 'Reminder identity, task, workspace, and creator cannot be changed'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' and actor_id is not null and new.created_by is distinct from actor_id then
    raise exception 'Reminder creator must be the current user'
      using errcode = '42501';
  end if;

  new.project_id := task_project_id;
  new.workspace_id := task_workspace_id;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names as timezone_entry
    where timezone_entry.name = new.timezone
  ) then
    raise exception 'Unknown reminder timezone: %', new.timezone
      using errcode = '22023';
  end if;

  effective_plan := private.effective_workspace_plan(task_workspace_id);
  select *
  into plan_limits
  from public.subscription_plans as sp
  where sp.code = effective_plan;

  if not found then
    raise exception 'Workspace does not have an effective subscription plan'
      using errcode = '23514';
  end if;

  if new.email_enabled and not plan_limits.email_enabled then
    raise exception 'The % plan does not include email reminders', effective_plan
      using errcode = 'P0001';
  end if;

  if effective_plan = 'guest' and task_creator_id is distinct from new.created_by then
    raise exception 'Guest reminders can only be attached to tasks created by that guest'
      using errcode = '42501';
  end if;

  if new.status = 'active' then
    -- Serialize all quota-changing operations for this workspace.
    perform pg_advisory_xact_lock(hashtextextended(task_workspace_id::text, 1));

    select count(*)
    into active_reminders_for_task
    from public.task_reminders as tr
    where tr.task_id = new.task_id
      and tr.status = 'active'
      and tr.id <> new.id;

    if active_reminders_for_task >= plan_limits.max_reminders_per_task then
      raise exception 'Plan limit reached: % active reminder(s) per task.',
        plan_limits.max_reminders_per_task
        using errcode = 'P0001';
    end if;

    if not exists (
      select 1
      from public.task_reminders as tr
      where tr.workspace_id = task_workspace_id
        and tr.task_id = new.task_id
        and tr.status = 'active'
        and tr.id <> new.id
    ) then
      select count(distinct tr.task_id)
      into active_reminder_tasks
      from public.task_reminders as tr
      where tr.workspace_id = task_workspace_id
        and tr.status = 'active'
        and tr.id <> new.id;

      if active_reminder_tasks >= plan_limits.max_active_reminder_tasks then
        raise exception 'Plan limit reached: reminders may be active on up to % task(s).',
          plan_limits.max_active_reminder_tasks
          using errcode = 'P0001';
      end if;
    end if;
  end if;

  return new;
end;
$$;

create function private.validate_task_reminder_recipient()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  reminder_task_id uuid;
  reminder_workspace_id uuid;
  reminder_creator_id uuid;
  task_creator_id uuid;
  effective_plan text;
  recipient_limit integer;
  recipient_count integer;
begin
  select tr.task_id, tr.workspace_id, tr.created_by, t.created_by
  into reminder_task_id, reminder_workspace_id, reminder_creator_id, task_creator_id
  from public.task_reminders as tr
  join public.tasks as t on t.id = tr.task_id
  where tr.id = new.reminder_id;

  if not found then
    raise exception 'Task reminder does not exist'
      using errcode = '23503';
  end if;

  if new.user_id is distinct from task_creator_id
    and not exists (
      select 1
      from public.task_assignees as ta
      where ta.task_id = reminder_task_id
        and ta.user_id = new.user_id
    )
  then
    raise exception 'Reminder recipients must be the task creator or an assignee'
      using errcode = '23514';
  end if;

  effective_plan := private.effective_workspace_plan(reminder_workspace_id);
  select sp.max_recipients_per_reminder
  into recipient_limit
  from public.subscription_plans as sp
  where sp.code = effective_plan;

  if recipient_limit is null then
    raise exception 'Workspace does not have an effective subscription plan'
      using errcode = '23514';
  end if;

  if effective_plan = 'guest' and new.user_id is distinct from reminder_creator_id then
    raise exception 'Guest reminders can only notify the guest who created them'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.reminder_id::text, 2));

  select count(*)
  into recipient_count
  from public.task_reminder_recipients as recipient
  where recipient.reminder_id = new.reminder_id
    and recipient.user_id <> new.user_id;

  if recipient_count >= recipient_limit then
    raise exception 'Plan limit reached: % recipient(s) per reminder.', recipient_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function private.effective_workspace_plan(uuid) from public;
revoke execute on function private.set_task_reminder_context_and_enforce_limits() from public;
revoke execute on function private.validate_task_reminder_recipient() from public;

create trigger task_reminders_set_context_and_enforce_limits
before insert or update on public.task_reminders
for each row execute function private.set_task_reminder_context_and_enforce_limits();

create trigger task_reminders_set_updated_at
before update on public.task_reminders
for each row execute function private.set_updated_at();

create trigger task_reminder_recipients_validate
before insert or update on public.task_reminder_recipients
for each row execute function private.validate_task_reminder_recipient();

comment on table public.task_reminders is
  'Task reminder schedules with database-enforced workspace plan limits.';
comment on table public.task_reminder_recipients is
  'Task creators and assignees selected to receive a reminder occurrence.';
comment on column public.task_reminders.next_run_at is
  'Next UTC execution instant; timezone preserves the local recurrence intent across DST.';

commit;
