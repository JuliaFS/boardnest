begin;

-- Keep the original local calendar anchor so month-end recurrences do not
-- drift after a shorter month (for example, Jan 31 -> Feb 28 -> Mar 31).
alter table public.scheduled_notifications
  add column anchor_local_at timestamp without time zone;

update public.scheduled_notifications
set anchor_local_at = next_run_at at time zone timezone;

alter table public.scheduled_notifications
  alter column anchor_local_at set not null;

create function private.set_scheduled_notification_anchor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.anchor_local_at := new.next_run_at at time zone new.timezone;
  elsif (
    new.next_run_at,
    new.timezone,
    new.schedule_kind,
    new.interval_value,
    new.interval_unit
  ) is distinct from (
    old.next_run_at,
    old.timezone,
    old.schedule_kind,
    old.interval_value,
    old.interval_unit
  ) and new.last_run_at is not distinct from old.last_run_at then
    -- Authenticated edits establish a new recurrence anchor. Scheduler
    -- advancement changes last_run_at in the same statement and keeps it.
    new.anchor_local_at := new.next_run_at at time zone new.timezone;
  end if;

  return new;
end;
$$;

revoke execute on function private.set_scheduled_notification_anchor()
from public;

create trigger scheduled_notifications_00_set_anchor
before insert or update on public.scheduled_notifications
for each row execute function private.set_scheduled_notification_anchor();

-- The original user validator rejected trusted scheduler updates because a
-- service-role request has no end-user auth.uid(). Preserve every user check,
-- but allow the service role to advance existing execution state.
create or replace function private.validate_scheduled_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  trusted_service boolean := coalesce((select auth.role()) = 'service_role', false)
    or current_setting('role', true) = 'service_role';
  effective_plan text;
  plan_limits public.subscription_plans%rowtype;
  context_project_id uuid;
  context_workspace_id uuid;
  active_schedule_count integer;
  channels record;
begin
  if actor_id is null and trusted_service then
    if tg_op <> 'UPDATE' then
      raise exception 'The scheduler may only advance an existing scheduled notification'
        using errcode = '42501';
    end if;

    if (new.id, new.workspace_id, new.project_id, new.task_id, new.created_by,
        new.title, new.body, new.schedule_kind, new.interval_value,
        new.interval_unit, new.timezone, new.ends_at, new.in_app_enabled,
        new.email_enabled, new.created_at)
      is distinct from
       (old.id, old.workspace_id, old.project_id, old.task_id, old.created_by,
        old.title, old.body, old.schedule_kind, old.interval_value,
        old.interval_unit, old.timezone, old.ends_at, old.in_app_enabled,
        old.email_enabled, old.created_at)
    then
      raise exception 'The scheduler may only update notification execution state'
        using errcode = '42501';
    end if;

    return new;
  end if;

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

-- Calculate sub-day recurrences as elapsed time and calendar recurrences in
-- local wall-clock time. Month/year schedules clamp to the final valid day.
create function private.scheduled_notification_run_after_steps(
  interval_value integer,
  interval_unit text,
  previous_run_at timestamptz,
  anchor_local_at timestamp without time zone,
  notification_timezone text,
  step_count bigint
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  previous_local timestamp without time zone;
  target_local timestamp without time zone;
  target_month timestamp without time zone;
  anchor_day integer;
  last_day integer;
  total_months bigint;
begin
  if interval_value is null or interval_value < 1
    or step_count < 1
    or interval_unit not in ('minute', 'hour', 'day', 'week', 'month', 'year')
  then
    raise exception 'Invalid scheduled notification recurrence'
      using errcode = '22023';
  end if;

  previous_local := previous_run_at at time zone notification_timezone;

  if interval_unit in ('minute', 'hour') then
    -- Sub-day intervals represent elapsed time. Advancing the instant avoids
    -- duplicate or missing hourly occurrences when the UTC offset changes.
    return previous_run_at + case interval_unit
      when 'minute' then interval '1 minute' * (interval_value::double precision * step_count)
      when 'hour' then interval '1 hour' * (interval_value::double precision * step_count)
    end;
  elsif interval_unit in ('day', 'week') then
    -- Calendar intervals preserve the original local wall-clock time. Using
    -- the anchor repairs the following run even when PostgreSQL must map a
    -- nonexistent spring-forward time to the first valid instant after it.
    target_local := date_trunc('day', previous_local)
      + case interval_unit
          when 'day' then interval '1 day' * (interval_value::double precision * step_count)
          when 'week' then interval '1 week' * (interval_value::double precision * step_count)
        end
      + (anchor_local_at - date_trunc('day', anchor_local_at));
  else
    total_months := interval_value::bigint * step_count
      * case when interval_unit = 'year' then 12 else 1 end;
    target_month := date_trunc('month', previous_local)
      + make_interval(months => total_months::integer);
    anchor_day := extract(day from anchor_local_at)::integer;
    last_day := extract(
      day from date_trunc('month', target_month) + interval '1 month' - interval '1 day'
    )::integer;
    target_local := target_month
      + make_interval(days => least(anchor_day, last_day) - 1)
      + (anchor_local_at - date_trunc('day', anchor_local_at));
  end if;

  return target_local at time zone notification_timezone;
end;
$$;

create function private.next_scheduled_notification_run(
  interval_value integer,
  interval_unit text,
  previous_run_at timestamptz,
  anchor_local_at timestamp without time zone,
  notification_timezone text,
  after_at timestamptz
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  candidate timestamptz;
  elapsed_units numeric;
  local_after timestamp without time zone;
  local_previous timestamp without time zone;
  month_difference bigint;
  step_count bigint := 1;
  step_months bigint;
  step_seconds numeric;
begin
  candidate := private.scheduled_notification_run_after_steps(
    interval_value,
    interval_unit,
    previous_run_at,
    anchor_local_at,
    notification_timezone,
    1
  );
  if candidate > after_at then
    return candidate;
  end if;

  local_after := after_at at time zone notification_timezone;
  local_previous := previous_run_at at time zone notification_timezone;

  if interval_unit in ('minute', 'hour') then
    step_seconds := interval_value::numeric * case interval_unit
      when 'minute' then 60
      when 'hour' then 3600
    end;
    elapsed_units := extract(epoch from (after_at - previous_run_at));
    step_count := greatest(1, floor(elapsed_units / step_seconds)::bigint);
  elsif interval_unit in ('day', 'week') then
    step_seconds := interval_value::numeric * case interval_unit
      when 'day' then 86400
      when 'week' then 604800
    end;
    elapsed_units := extract(epoch from (local_after - local_previous));
    step_count := greatest(1, floor(elapsed_units / step_seconds)::bigint);
  else
    month_difference :=
      (extract(year from local_after)::bigint - extract(year from local_previous)::bigint) * 12
      + extract(month from local_after)::bigint
      - extract(month from local_previous)::bigint;
    step_months := interval_value::bigint
      * case when interval_unit = 'year' then 12 else 1 end;
    step_count := greatest(1, month_difference / step_months);
  end if;

  candidate := private.scheduled_notification_run_after_steps(
    interval_value,
    interval_unit,
    previous_run_at,
    anchor_local_at,
    notification_timezone,
    step_count
  );

  while candidate <= after_at loop
    step_count := step_count + 1;
    candidate := private.scheduled_notification_run_after_steps(
      interval_value,
      interval_unit,
      previous_run_at,
      anchor_local_at,
      notification_timezone,
      step_count
    );
  end loop;

  return candidate;
end;
$$;

revoke all on function private.scheduled_notification_run_after_steps(
  integer, text, timestamptz, timestamp without time zone, text, bigint
) from public, anon, authenticated;
revoke all on function private.next_scheduled_notification_run(
  integer, text, timestamptz, timestamp without time zone, text, timestamptz
) from public, anon, authenticated;

-- Requested channels are a trusted producer hint. Existing system producers
-- omit the object and retain the original all-entitled-channels behavior.
create or replace function private.queue_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  channels record;
  delivery_key text;
begin
  if new.reminder_id is not null then
    return new;
  end if;

  if new.payload ? 'requestedChannels'
    and jsonb_typeof(new.payload #> '{requestedChannels,email}') = 'boolean'
    and not (new.payload #>> '{requestedChannels,email}')::boolean
  then
    return new;
  end if;

  select * into channels
  from private.notification_event_channels(new.user_id, new.workspace_id, new.type);

  if not found or not channels.email_enabled then
    return new;
  end if;

  delivery_key := case
    when new.event_key is not null then
      'notification-event:' || encode(
        extensions.digest(new.user_id::text || ':' || new.event_key, 'sha256'),
        'hex'
      )
    else
      'notification-event:' || encode(
        extensions.digest(new.user_id::text || ':' || new.id::text, 'sha256'),
        'hex'
      )
  end;

  begin
    insert into public.notification_deliveries (
      reminder_id,
      notification_id,
      workspace_id,
      user_id,
      scheduled_for,
      next_attempt_at,
      idempotency_key,
      payload
    )
    values (
      new.reminder_id,
      new.id,
      new.workspace_id,
      new.user_id,
      coalesce(new.scheduled_for, new.created_at),
      coalesce(new.scheduled_for, new.created_at),
      delivery_key,
      new.payload || jsonb_build_object(
        'notificationId', new.id,
        'eventType', new.type,
        'title', new.title,
        'body', new.body,
        'actorId', new.actor_id,
        'projectId', new.project_id,
        'taskId', new.task_id
      )
    )
    on conflict (idempotency_key) do nothing;
  exception
    when sqlstate 'P0001' then null;
  end;

  return new;
end;
$$;

create or replace function public.create_notification_event(
  p_event_key text,
  p_user_id uuid,
  p_workspace_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_actor_id uuid default null,
  p_project_id uuid default null,
  p_task_id uuid default null,
  p_scheduled_for timestamptz default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  channels record;
  created_notification_id uuid;
  delivery_key text;
  requested_email boolean := true;
  requested_in_app boolean := true;
begin
  if p_event_key is null
    or char_length(btrim(p_event_key)) not between 16 and 220 then
    raise exception 'Notification event key must contain between 16 and 220 characters'
      using errcode = '22023';
  end if;

  if p_title is null or char_length(btrim(p_title)) not between 1 and 160 then
    raise exception 'Notification title must contain between 1 and 160 characters'
      using errcode = '22023';
  end if;

  if p_body is not null and char_length(p_body) > 2000 then
    raise exception 'Notification body cannot exceed 2000 characters'
      using errcode = '22023';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Notification payload must be a JSON object'
      using errcode = '22023';
  end if;

  if p_payload ? 'requestedChannels' then
    if jsonb_typeof(p_payload -> 'requestedChannels') <> 'object'
      or jsonb_typeof(p_payload #> '{requestedChannels,inApp}') <> 'boolean'
      or jsonb_typeof(p_payload #> '{requestedChannels,email}') <> 'boolean'
    then
      raise exception 'Requested notification channels must contain Boolean inApp and email values'
        using errcode = '22023';
    end if;
    requested_in_app := (p_payload #>> '{requestedChannels,inApp}')::boolean;
    requested_email := (p_payload #>> '{requestedChannels,email}')::boolean;
  end if;

  if not requested_in_app and not requested_email then
    raise exception 'At least one notification channel must be requested'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.notification_event_types as event
    where event.code = p_type and event.is_active
  ) then
    raise exception 'Unknown or inactive notification event type: %', p_type
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.workspace_members as member
    where member.workspace_id = p_workspace_id
      and member.user_id = p_user_id
  ) then
    raise exception 'Notification recipient must be a workspace member'
      using errcode = '23514';
  end if;

  if p_actor_id is not null and not exists (
    select 1 from public.workspace_members as actor
    where actor.workspace_id = p_workspace_id
      and actor.user_id = p_actor_id
  ) then
    raise exception 'Notification actor must be a workspace member'
      using errcode = '23514';
  end if;

  if p_project_id is not null and not exists (
    select 1 from public.projects as project
    where project.id = p_project_id
      and project.workspace_id = p_workspace_id
  ) then
    raise exception 'Notification project does not belong to the workspace'
      using errcode = '23514';
  end if;

  if p_task_id is not null and not exists (
    select 1
    from public.tasks as task
    join public.projects as project on project.id = task.project_id
    where task.id = p_task_id
      and project.workspace_id = p_workspace_id
      and (p_project_id is null or project.id = p_project_id)
  ) then
    raise exception 'Notification task does not belong to its project and workspace'
      using errcode = '23514';
  end if;

  select * into channels
  from private.notification_event_channels(p_user_id, p_workspace_id, p_type);

  if not found then
    return null;
  end if;

  channels.in_app_enabled := coalesce(channels.in_app_enabled, false)
    and requested_in_app;
  channels.email_enabled := coalesce(channels.email_enabled, false)
    and requested_email;

  if not channels.in_app_enabled and not channels.email_enabled then
    return null;
  end if;

  if channels.in_app_enabled then
    insert into public.notifications (
      user_id, workspace_id, project_id, task_id, actor_id, event_key,
      scheduled_for, type, title, body, payload
    )
    values (
      p_user_id, p_workspace_id, p_project_id, p_task_id, p_actor_id,
      btrim(p_event_key), p_scheduled_for, p_type, p_title, p_body, p_payload
    )
    on conflict (user_id, event_key) where event_key is not null
    do nothing
    returning id into created_notification_id;

    if created_notification_id is null then
      select notification.id into created_notification_id
      from public.notifications as notification
      where notification.user_id = p_user_id
        and notification.event_key = btrim(p_event_key);
    end if;
  elsif channels.email_enabled then
    delivery_key := 'notification-event:' || encode(
      extensions.digest(p_user_id::text || ':' || btrim(p_event_key), 'sha256'),
      'hex'
    );

    begin
      insert into public.notification_deliveries (
        workspace_id, user_id, scheduled_for, next_attempt_at,
        idempotency_key, payload
      )
      values (
        p_workspace_id,
        p_user_id,
        coalesce(p_scheduled_for, statement_timestamp()),
        coalesce(p_scheduled_for, statement_timestamp()),
        delivery_key,
        p_payload || jsonb_build_object(
          'eventType', p_type,
          'title', p_title,
          'body', p_body,
          'actorId', p_actor_id,
          'projectId', p_project_id,
          'taskId', p_task_id
        )
      )
      on conflict (idempotency_key) do nothing;
    exception
      when sqlstate 'P0001' then null;
    end;
  end if;

  return created_notification_id;
end;
$$;

create function public.process_due_scheduled_notifications(
  p_batch_size integer default 100,
  p_now timestamptz default statement_timestamp()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  due_schedule record;
  event_key text;
  following_run_at timestamptz;
  occurrence_at timestamptz;
  processed_count integer := 0;
begin
  if p_batch_size < 1 or p_batch_size > 500 then
    raise exception 'Custom notification scheduler batch size must be between 1 and 500'
      using errcode = '22023';
  end if;

  for due_schedule in
    select schedule.*
    from public.scheduled_notifications as schedule
    where schedule.status = 'active'
      and schedule.next_run_at <= p_now
    order by schedule.next_run_at, schedule.id
    limit p_batch_size
    for update of schedule skip locked
  loop
    occurrence_at := due_schedule.next_run_at;

    if not exists (
      select 1
      from public.workspace_members as member
      where member.workspace_id = due_schedule.workspace_id
        and member.user_id = due_schedule.created_by
    ) then
      update public.scheduled_notifications
      set status = 'canceled'
      where id = due_schedule.id;
      processed_count := processed_count + 1;
      continue;
    end if;

    if due_schedule.project_id is not null and not exists (
      select 1
      from public.projects as project
      join public.workspace_members as workspace_member
        on workspace_member.workspace_id = project.workspace_id
       and workspace_member.user_id = due_schedule.created_by
      left join public.project_members as project_member
        on project_member.project_id = project.id
       and project_member.user_id = due_schedule.created_by
      where project.id = due_schedule.project_id
        and (
          project.visibility = 'workspace'
          or workspace_member.role in ('owner', 'admin')
          or project_member.user_id is not null
        )
    ) then
      update public.scheduled_notifications
      set status = 'canceled'
      where id = due_schedule.id;
      processed_count := processed_count + 1;
      continue;
    end if;

    event_key := 'custom-notification:' || due_schedule.id::text || ':'
      || extract(epoch from occurrence_at)::text;

    perform public.create_notification_event(
      event_key,
      due_schedule.created_by,
      due_schedule.workspace_id,
      'custom.notification',
      due_schedule.title,
      due_schedule.body,
      due_schedule.created_by,
      due_schedule.project_id,
      due_schedule.task_id,
      occurrence_at,
      jsonb_build_object(
        'scheduledNotificationId', due_schedule.id,
        'workspaceId', due_schedule.workspace_id,
        'projectId', due_schedule.project_id,
        'taskId', due_schedule.task_id,
        'scheduledFor', occurrence_at,
        'source', 'custom-schedule',
        'requestedChannels', jsonb_build_object(
          'inApp', due_schedule.in_app_enabled,
          'email', due_schedule.email_enabled
        )
      )
    );

    if due_schedule.schedule_kind = 'once' then
      update public.scheduled_notifications
      set last_run_at = occurrence_at,
          status = 'completed'
      where id = due_schedule.id;
    else
      following_run_at := private.next_scheduled_notification_run(
        due_schedule.interval_value,
        due_schedule.interval_unit,
        occurrence_at,
        due_schedule.anchor_local_at,
        due_schedule.timezone,
        p_now
      );

      if due_schedule.ends_at is not null
        and following_run_at >= due_schedule.ends_at
      then
        update public.scheduled_notifications
        set last_run_at = occurrence_at,
            status = 'completed'
        where id = due_schedule.id;
      else
        update public.scheduled_notifications
        set last_run_at = occurrence_at,
            next_run_at = following_run_at
        where id = due_schedule.id;
      end if;
    end if;

    processed_count := processed_count + 1;
  end loop;

  return processed_count;
end;
$$;

revoke all on function public.process_due_scheduled_notifications(
  integer, timestamptz
) from public, anon, authenticated;
grant execute on function public.process_due_scheduled_notifications(
  integer, timestamptz
) to service_role;

comment on column public.scheduled_notifications.anchor_local_at is
  'Immutable recurrence anchor in the selected timezone, refreshed only by user schedule edits.';
comment on function private.next_scheduled_notification_run(
  integer, text, timestamptz, timestamp without time zone, text, timestamptz
) is
  'Returns the first future custom-notification occurrence while skipping missed elapsed or local-calendar intervals.';
comment on function public.process_due_scheduled_notifications(
  integer, timestamptz
) is
  'Service-role-only, concurrency-safe processor for due custom notification schedules.';

commit;
