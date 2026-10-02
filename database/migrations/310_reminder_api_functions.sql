begin;

-- Keep the reminder and its initial recipients in one transaction. The
-- function explicitly authorizes the JWT actor; quota and recipient triggers
-- remain authoritative while the transaction stays atomic.
create function public.create_task_reminder_with_recipients(
  p_task_id uuid,
  p_schedule_kind text,
  p_timezone text,
  p_next_run_at timestamptz,
  p_ends_at timestamptz,
  p_in_app_enabled boolean,
  p_email_enabled boolean,
  p_stop_when_completed boolean,
  p_recipient_ids uuid[]
)
returns setof public.task_reminders
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  created_reminder public.task_reminders%rowtype;
begin
  if actor_id is null or not private.can_edit_task(p_task_id) then
    raise exception 'You do not have permission to create a reminder for this task'
      using errcode = '42501';
  end if;

  if coalesce(pg_catalog.cardinality(p_recipient_ids), 0) = 0 then
    raise exception 'A reminder must have at least one recipient'
      using errcode = '23514';
  end if;

  if pg_catalog.cardinality(p_recipient_ids) is distinct from (
    select count(distinct recipient_id)
    from pg_catalog.unnest(p_recipient_ids) as recipient_id
  ) then
    raise exception 'Reminder recipients must be unique'
      using errcode = '23514';
  end if;

  insert into public.task_reminders (
    task_id,
    created_by,
    schedule_kind,
    timezone,
    next_run_at,
    ends_at,
    in_app_enabled,
    email_enabled,
    stop_when_completed
  )
  values (
    p_task_id,
    actor_id,
    p_schedule_kind,
    p_timezone,
    p_next_run_at,
    p_ends_at,
    p_in_app_enabled,
    p_email_enabled,
    p_stop_when_completed
  )
  returning * into created_reminder;

  insert into public.task_reminder_recipients (reminder_id, user_id)
  select created_reminder.id, recipient_id
  from pg_catalog.unnest(p_recipient_ids) as recipient_id;

  return next created_reminder;
end;
$$;

-- Recipient replacement is also atomic: an invalid new recipient rolls the
-- deletion back and preserves the previous recipient set.
create function public.replace_task_reminder_recipients(
  p_reminder_id uuid,
  p_recipient_ids uuid[]
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_total integer;
begin
  if (select auth.uid()) is null
    or not private.can_manage_task_reminder(p_reminder_id)
  then
    raise exception 'You do not have permission to change these reminder recipients'
      using errcode = '42501';
  end if;

  if coalesce(pg_catalog.cardinality(p_recipient_ids), 0) = 0 then
    raise exception 'A reminder must have at least one recipient'
      using errcode = '23514';
  end if;

  if pg_catalog.cardinality(p_recipient_ids) is distinct from (
    select count(distinct recipient_id)
    from pg_catalog.unnest(p_recipient_ids) as recipient_id
  ) then
    raise exception 'Reminder recipients must be unique'
      using errcode = '23514';
  end if;

  delete from public.task_reminder_recipients
  where reminder_id = p_reminder_id;

  insert into public.task_reminder_recipients (reminder_id, user_id)
  select p_reminder_id, recipient_id
  from pg_catalog.unnest(p_recipient_ids) as recipient_id;

  get diagnostics recipient_total = row_count;
  return recipient_total;
end;
$$;

revoke all on function public.create_task_reminder_with_recipients(
  uuid, text, text, timestamptz, timestamptz, boolean, boolean, boolean, uuid[]
) from public, anon;
revoke all on function public.replace_task_reminder_recipients(uuid, uuid[])
from public, anon;

grant execute on function public.create_task_reminder_with_recipients(
  uuid, text, text, timestamptz, timestamptz, boolean, boolean, boolean, uuid[]
) to authenticated;
grant execute on function public.replace_task_reminder_recipients(uuid, uuid[])
to authenticated;

comment on function public.create_task_reminder_with_recipients(
  uuid, text, text, timestamptz, timestamptz, boolean, boolean, boolean, uuid[]
) is 'Atomically creates an authorized task reminder and its recipients after explicit JWT and task-access checks.';
comment on function public.replace_task_reminder_recipients(uuid, uuid[]) is
  'Atomically replaces a reminder recipient set after explicit JWT and reminder-management checks.';

commit;
