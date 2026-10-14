begin;

alter table public.subscription_plans
  add column max_scheduled_notifications integer not null default 0,
  add column min_schedule_interval_minutes integer not null default 1440;

update public.subscription_plans
set max_scheduled_notifications = case code
      when 'guest' then 3
      when 'free' then 10
      when 'pro' then 100
      else 0
    end,
    min_schedule_interval_minutes = case code
      when 'guest' then 1440
      when 'free' then 60
      when 'pro' then 5
      else 1440
    end;

alter table public.subscription_plans
  add constraint subscription_plans_schedule_limits_check
  check (
    max_scheduled_notifications >= 0
    and min_schedule_interval_minutes between 1 and 525600
  );

create table public.scheduled_notifications (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  project_id uuid,
  task_id uuid,
  created_by uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  schedule_kind text not null,
  interval_value integer,
  interval_unit text,
  timezone text not null default 'UTC',
  next_run_at timestamptz not null,
  ends_at timestamptz,
  last_run_at timestamptz,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  status text not null default 'active',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  constraint scheduled_notifications_project_workspace_fk
    foreign key (project_id, workspace_id)
    references public.projects (id, workspace_id)
    on delete cascade,
  constraint scheduled_notifications_task_project_fk
    foreign key (task_id, project_id)
    references public.tasks (id, project_id)
    on delete cascade,
  constraint scheduled_notifications_title_check
    check (char_length(btrim(title)) between 1 and 160),
  constraint scheduled_notifications_body_check
    check (body is null or char_length(body) <= 2000),
  constraint scheduled_notifications_schedule_kind_check
    check (schedule_kind in ('once', 'interval')),
  constraint scheduled_notifications_interval_unit_check
    check (interval_unit is null or interval_unit in ('minute', 'hour', 'day', 'week', 'month', 'year')),
  constraint scheduled_notifications_interval_shape_check
    check (
      (schedule_kind = 'once' and interval_value is null and interval_unit is null)
      or (
        schedule_kind = 'interval'
        and interval_value between 1 and 1000
        and interval_unit is not null
      )
    ),
  constraint scheduled_notifications_timezone_check
    check (char_length(btrim(timezone)) between 1 and 100),
  constraint scheduled_notifications_context_check
    check (task_id is null or project_id is not null),
  constraint scheduled_notifications_channel_check
    check (in_app_enabled or email_enabled),
  constraint scheduled_notifications_status_check
    check (status in ('active', 'paused', 'completed', 'canceled')),
  constraint scheduled_notifications_end_check
    check (ends_at is null or ends_at > next_run_at),
  constraint scheduled_notifications_last_run_check
    check (last_run_at is null or last_run_at >= created_at)
);

alter table public.scheduled_notifications enable row level security;

create index scheduled_notifications_due_idx
  on public.scheduled_notifications (next_run_at, id)
  where status = 'active';
create index scheduled_notifications_owner_workspace_idx
  on public.scheduled_notifications (created_by, workspace_id, created_at desc);
create index scheduled_notifications_project_idx
  on public.scheduled_notifications (project_id, created_at desc)
  where project_id is not null;
create index scheduled_notifications_task_idx
  on public.scheduled_notifications (task_id, created_at desc)
  where task_id is not null;

create function private.scheduled_notification_interval_minutes(
  interval_value integer,
  interval_unit text
)
returns bigint
language sql
immutable
set search_path = ''
as $$
  select interval_value::bigint * case interval_unit
    when 'minute' then 1
    when 'hour' then 60
    when 'day' then 1440
    when 'week' then 10080
    when 'month' then 43200
    when 'year' then 525600
    else 0
  end
$$;

create function private.validate_scheduled_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  effective_plan text;
  plan_limits public.subscription_plans%rowtype;
  context_project_id uuid;
  context_workspace_id uuid;
  active_schedule_count integer;
  channels record;
begin
  if actor_id is null then
    raise exception 'Authentication is required to manage scheduled notifications'
      using errcode = '42501';
  end if;

  if tg_op = 'INSERT' then
    if new.created_by is distinct from actor_id then
      raise exception 'Scheduled notification creator must be the current user'
        using errcode = '42501';
    end if;
  elsif (new.id, new.workspace_id, new.created_by, new.created_at)
    is distinct from (old.id, old.workspace_id, old.created_by, old.created_at)
  then
    raise exception 'Scheduled notification identity, workspace, creator, and creation time cannot be changed'
      using errcode = '23514';
  end if;

  if not private.is_workspace_member(new.workspace_id) then
    raise exception 'You do not have access to this workspace'
      using errcode = '42501';
  end if;

  if new.task_id is not null then
    select task.project_id, project.workspace_id
    into context_project_id, context_workspace_id
    from public.tasks as task
    join public.projects as project on project.id = task.project_id
    where task.id = new.task_id;

    if not found
      or context_project_id is distinct from new.project_id
      or context_workspace_id is distinct from new.workspace_id
      or not private.can_access_task(new.task_id) then
      raise exception 'Task context is invalid or inaccessible'
        using errcode = '42501';
    end if;
  elsif new.project_id is not null then
    select project.workspace_id into context_workspace_id
    from public.projects as project
    where project.id = new.project_id;

    if not found
      or context_workspace_id is distinct from new.workspace_id
      or not private.can_access_project(new.project_id) then
      raise exception 'Project context is invalid or inaccessible'
        using errcode = '42501';
    end if;
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_timezone_names as timezone_entry
    where timezone_entry.name = new.timezone
  ) then
    raise exception 'Unknown notification timezone: %', new.timezone
      using errcode = '22023';
  end if;

  effective_plan := private.effective_workspace_plan(new.workspace_id);
  select * into plan_limits
  from public.subscription_plans as plan
  where plan.code = effective_plan;

  if not found then
    raise exception 'Workspace does not have an effective subscription plan'
      using errcode = '23514';
  end if;

  if new.status = 'active' then
    select * into channels
    from private.notification_event_channels(
      new.created_by,
      new.workspace_id,
      'custom.notification'
    );

    if not found then
      raise exception 'Custom notifications are unavailable for the current plan'
        using errcode = 'P0001';
    end if;

    if new.in_app_enabled and not channels.in_app_enabled then
      raise exception 'In-app custom notifications are disabled by the current plan or preferences'
        using errcode = 'P0001';
    end if;

    if new.email_enabled and not channels.email_enabled then
      raise exception 'Email custom notifications are disabled by the current plan or preferences'
        using errcode = 'P0001';
    end if;

    if new.schedule_kind = 'interval'
      and private.scheduled_notification_interval_minutes(
        new.interval_value,
        new.interval_unit
      ) < plan_limits.min_schedule_interval_minutes
    then
      raise exception 'The % plan requires a custom notification interval of at least % minute(s)',
        effective_plan,
        plan_limits.min_schedule_interval_minutes
        using errcode = 'P0001';
    end if;

    perform pg_advisory_xact_lock(
      hashtextextended(new.workspace_id::text || ':' || new.created_by::text, 2)
    );

    select count(*) into active_schedule_count
    from public.scheduled_notifications as schedule
    where schedule.workspace_id = new.workspace_id
      and schedule.created_by = new.created_by
      and schedule.status = 'active'
      and schedule.id <> new.id;

    if active_schedule_count >= plan_limits.max_scheduled_notifications then
      raise exception 'Plan limit reached: % active custom notification schedule(s) per user and workspace.',
        plan_limits.max_scheduled_notifications
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.scheduled_notification_interval_minutes(integer, text)
from public;
revoke execute on function private.validate_scheduled_notification()
from public;

create trigger scheduled_notifications_validate
before insert or update on public.scheduled_notifications
for each row execute function private.validate_scheduled_notification();

create trigger scheduled_notifications_set_updated_at
before update on public.scheduled_notifications
for each row execute function private.set_updated_at();

create policy "scheduled_notifications_select_owner"
on public.scheduled_notifications for select to authenticated
using (
  created_by = (select auth.uid())
  and (select private.is_workspace_member(workspace_id))
  and (project_id is null or (select private.can_access_project(project_id)))
);

create policy "scheduled_notifications_insert_owner"
on public.scheduled_notifications for insert to authenticated
with check (created_by = (select auth.uid()));

create policy "scheduled_notifications_update_owner"
on public.scheduled_notifications for update to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));

create policy "scheduled_notifications_delete_owner"
on public.scheduled_notifications for delete to authenticated
using (created_by = (select auth.uid()));

grant select on public.scheduled_notifications to authenticated;
grant insert (
  workspace_id,
  project_id,
  task_id,
  created_by,
  title,
  body,
  schedule_kind,
  interval_value,
  interval_unit,
  timezone,
  next_run_at,
  ends_at,
  in_app_enabled,
  email_enabled
) on public.scheduled_notifications to authenticated;
grant update (
  project_id,
  task_id,
  title,
  body,
  schedule_kind,
  interval_value,
  interval_unit,
  timezone,
  next_run_at,
  ends_at,
  in_app_enabled,
  email_enabled,
  status
) on public.scheduled_notifications to authenticated;
grant delete on public.scheduled_notifications to authenticated;

grant select, insert, update, delete on public.scheduled_notifications to service_role;

comment on table public.scheduled_notifications is
  'User-owned custom notification schedules with optional workspace, project, and task context.';
comment on column public.scheduled_notifications.next_run_at is
  'Next absolute UTC occurrence; timezone preserves local calendar recurrence intent.';
comment on column public.scheduled_notifications.interval_value is
  'Positive multiplier for recurring custom intervals; null for one-time schedules.';
comment on function private.validate_scheduled_notification() is
  'Validates tenant context, plan quota, interval entitlement, channels, and timezone.';

commit;
