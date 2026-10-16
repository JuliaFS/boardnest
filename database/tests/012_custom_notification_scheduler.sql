begin;

insert into auth.users (id, email, is_anonymous, raw_user_meta_data)
values (
  '00000000-0000-4000-8000-000000000121',
  'custom-scheduler@example.com',
  false,
  '{"display_name":"Custom Scheduler"}'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000121', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000121","role":"authenticated","is_anonymous":false}',
  true
);

insert into public.workspaces (id, name, slug, created_by)
values (
  '10000000-0000-4000-8000-000000000121',
  'Custom Scheduler Workspace',
  'custom-scheduler-workspace',
  '00000000-0000-4000-8000-000000000121'
);

insert into public.scheduled_notifications (
  id, workspace_id, created_by, title, body, schedule_kind, timezone,
  next_run_at, in_app_enabled, email_enabled
)
values
  (
    '50000000-0000-4000-8000-000000000121',
    '10000000-0000-4000-8000-000000000121',
    '00000000-0000-4000-8000-000000000121',
    'One-time in-app notification',
    'This occurrence must complete exactly once.',
    'once',
    'UTC',
    '2037-01-31 09:00:00+00',
    true,
    false
  ),
  (
    '50000000-0000-4000-8000-000000000122',
    '10000000-0000-4000-8000-000000000121',
    '00000000-0000-4000-8000-000000000121',
    'Email-only notification',
    null,
    'once',
    'UTC',
    '2037-01-31 09:15:00+00',
    false,
    true
  );

insert into public.scheduled_notifications (
  id, workspace_id, created_by, title, schedule_kind, interval_value,
  interval_unit, timezone, next_run_at, in_app_enabled, email_enabled
)
values
  (
    '50000000-0000-4000-8000-000000000123',
    '10000000-0000-4000-8000-000000000121',
    '00000000-0000-4000-8000-000000000121',
    'Month-end notification',
    'interval',
    1,
    'month',
    'UTC',
    '2037-01-31 10:00:00+00',
    true,
    false
  ),
  (
    '50000000-0000-4000-8000-000000000124',
    '10000000-0000-4000-8000-000000000121',
    '00000000-0000-4000-8000-000000000121',
    'Missed hourly notification',
    'interval',
    1,
    'hour',
    'UTC',
    '2037-01-29 08:00:00+00',
    true,
    false
  ),
  (
    '50000000-0000-4000-8000-000000000125',
    '10000000-0000-4000-8000-000000000121',
    '00000000-0000-4000-8000-000000000121',
    'DST notification',
    'interval',
    1,
    'day',
    'Europe/Sofia',
    '2037-03-28 08:00:00+00',
    true,
    false
  ),
  (
    '50000000-0000-4000-8000-000000000126',
    '10000000-0000-4000-8000-000000000121',
    '00000000-0000-4000-8000-000000000121',
    'DST gap notification',
    'interval',
    1,
    'day',
    'Europe/Sofia',
    '2037-03-28 01:30:00+00',
    true,
    false
  );

reset role;
set local role service_role;

do $$
declare
  processed integer;
begin
  processed := public.process_due_scheduled_notifications(
    100,
    '2037-01-31 12:00:00+00'
  );
  if processed <> 4 then
    raise exception 'Expected four initial due schedules, processed %', processed;
  end if;

  if public.process_due_scheduled_notifications(
    100,
    '2037-01-31 12:00:00+00'
  ) <> 0 then
    raise exception 'An already processed custom occurrence remained due';
  end if;
end;
$$;

reset role;

do $$
begin
  if not exists (
    select 1
    from public.scheduled_notifications
    where id = '50000000-0000-4000-8000-000000000121'
      and status = 'completed'
      and last_run_at = '2037-01-31 09:00:00+00'
  ) then
    raise exception 'The one-time custom schedule did not complete';
  end if;

  if (
    select count(*)
    from public.notifications
    where payload ->> 'scheduledNotificationId' =
      '50000000-0000-4000-8000-000000000121'
  ) <> 1 then
    raise exception 'The one-time custom occurrence was not created exactly once';
  end if;

  if exists (
    select 1
    from public.notification_deliveries
    where payload ->> 'scheduledNotificationId' =
      '50000000-0000-4000-8000-000000000121'
  ) then
    raise exception 'An in-app-only schedule unexpectedly queued email';
  end if;

  if exists (
    select 1
    from public.notifications
    where payload ->> 'scheduledNotificationId' =
      '50000000-0000-4000-8000-000000000122'
  ) then
    raise exception 'An email-only schedule unexpectedly created an in-app row';
  end if;

  if (
    select count(*)
    from public.notification_deliveries
    where payload ->> 'scheduledNotificationId' =
      '50000000-0000-4000-8000-000000000122'
  ) <> 1 then
    raise exception 'The email-only schedule did not create exactly one delivery';
  end if;

  if not exists (
    select 1
    from public.scheduled_notifications
    where id = '50000000-0000-4000-8000-000000000123'
      and anchor_local_at = '2037-01-31 10:00:00'
      and next_run_at = '2037-02-28 10:00:00+00'
  ) then
    raise exception 'The first month-end recurrence did not clamp to February';
  end if;

  if not exists (
    select 1
    from public.scheduled_notifications
    where id = '50000000-0000-4000-8000-000000000124'
      and next_run_at = '2037-01-31 13:00:00+00'
  ) then
    raise exception 'Missed hourly occurrences were not skipped to the first future run';
  end if;
end;
$$;

-- Simulate a recovery replay of the exact same committed occurrence. The
-- stable event and outbox keys must keep it idempotent.
set local role service_role;
update public.scheduled_notifications
set status = 'active',
    last_run_at = null,
    next_run_at = '2037-01-31 09:00:00+00'
where id = '50000000-0000-4000-8000-000000000121';

select public.process_due_scheduled_notifications(
  100,
  '2037-01-31 12:00:00+00'
);
reset role;

do $$
begin
  if (
    select count(*)
    from public.notifications
    where payload ->> 'scheduledNotificationId' =
      '50000000-0000-4000-8000-000000000121'
  ) <> 1 then
    raise exception 'Recovery replay duplicated a custom notification occurrence';
  end if;
end;
$$;

set local role service_role;
select public.process_due_scheduled_notifications(
  100,
  '2037-02-28 10:00:00+00'
);
reset role;

do $$
begin
  if not exists (
    select 1
    from public.scheduled_notifications
    where id = '50000000-0000-4000-8000-000000000123'
      and anchor_local_at = '2037-01-31 10:00:00'
      and next_run_at = '2037-03-31 10:00:00+00'
  ) then
    raise exception 'Month-end recurrence drifted away from its Jan 31 anchor';
  end if;
end;
$$;

set local role service_role;
select public.process_due_scheduled_notifications(
  100,
  '2037-03-29 08:00:00+00'
);
reset role;

do $$
begin
  if not exists (
    select 1
    from public.scheduled_notifications
    where id = '50000000-0000-4000-8000-000000000125'
      and last_run_at = '2037-03-28 08:00:00+00'
      and next_run_at = '2037-03-30 07:00:00+00'
  ) then
    raise exception 'Daily recurrence did not preserve 10:00 local time across DST';
  end if;

  if (
    select count(*)
    from public.notifications
    where payload ->> 'scheduledNotificationId' =
      '50000000-0000-4000-8000-000000000125'
  ) <> 1 then
    raise exception 'Downtime recovery flooded the recipient with missed DST occurrences';
  end if;

  if not exists (
    select 1
    from public.scheduled_notifications
    where id = '50000000-0000-4000-8000-000000000126'
      and anchor_local_at = '2037-03-28 03:30:00'
      and last_run_at = '2037-03-28 01:30:00+00'
      and next_run_at = '2037-03-30 00:30:00+00'
  ) then
    raise exception 'A spring-forward gap permanently shifted the local wall-clock anchor';
  end if;

  if (
    select count(*)
    from public.notifications
    where payload ->> 'scheduledNotificationId' =
      '50000000-0000-4000-8000-000000000126'
  ) <> 1 then
    raise exception 'DST gap recovery created more than one notification occurrence';
  end if;
end;
$$;

set local role service_role;
do $$
begin
  begin
    perform public.process_due_scheduled_notifications(0, statement_timestamp());
    raise exception 'Invalid scheduler batch size was accepted'
      using errcode = 'XX000';
  exception
    when sqlstate '22023' then null;
    when sqlstate 'XX000' then raise;
  end;
end;
$$;
reset role;

rollback;
