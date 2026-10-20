begin;

insert into auth.users (id, email, is_anonymous, raw_user_meta_data)
values
  (
    '00000000-0000-4000-8000-000000000011',
    null,
    true,
    '{"display_name":"Reminder Guest"}'
  ),
  (
    '00000000-0000-4000-8000-000000000012',
    'reminder-owner@example.com',
    false,
    '{"display_name":"Reminder Owner"}'
  );

do $$
begin
  if (
    select count(*)
    from public.notification_preferences
    where user_id in (
      '00000000-0000-4000-8000-000000000011',
      '00000000-0000-4000-8000-000000000012'
    )
  ) <> 2 then
    raise exception 'Expected default notification preferences for both users';
  end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000011","role":"authenticated","is_anonymous":true}',
  true
);

insert into public.workspaces (id, name, slug, created_by)
values (
  '10000000-0000-4000-8000-000000000011',
  'Reminder Guest Workspace',
  'reminder-guest-workspace',
  '00000000-0000-4000-8000-000000000011'
);

do $$
begin
  if not exists (
    select 1
    from public.workspace_subscriptions
    where workspace_id = '10000000-0000-4000-8000-000000000011'
      and plan_code = 'guest'
      and status = 'active'
  ) then
    raise exception 'Expected an active guest subscription';
  end if;
end;
$$;

insert into public.projects (
  id,
  workspace_id,
  name,
  visibility,
  status,
  created_by
)
values (
  '20000000-0000-4000-8000-000000000011',
  '10000000-0000-4000-8000-000000000011',
  'Guest Reminder Project',
  'workspace',
  'active',
  '00000000-0000-4000-8000-000000000011'
);

insert into public.tasks (id, project_id, status_id, title, created_by)
select
  task.id,
  '20000000-0000-4000-8000-000000000011',
  status.id,
  task.title,
  '00000000-0000-4000-8000-000000000011'
from (
  values
    ('30000000-0000-4000-8000-000000000011'::uuid, 'Reminder task one'),
    ('30000000-0000-4000-8000-000000000012'::uuid, 'Reminder task two'),
    ('30000000-0000-4000-8000-000000000013'::uuid, 'Reminder task three'),
    ('30000000-0000-4000-8000-000000000014'::uuid, 'Reminder task four')
) as task(id, title)
cross join lateral (
  select ts.id
  from public.task_statuses as ts
  where ts.project_id = '20000000-0000-4000-8000-000000000011'
  order by ts.position
  limit 1
) as status;

insert into public.task_reminders (
  task_id,
  created_by,
  schedule_kind,
  timezone,
  next_run_at
)
values
  (
    '30000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000011',
    'weekly',
    'Europe/Sofia',
    statement_timestamp() + interval '1 week'
  ),
  (
    '30000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000011',
    'monthly',
    'Europe/Sofia',
    statement_timestamp() + interval '1 month'
  ),
  (
    '30000000-0000-4000-8000-000000000013',
    '00000000-0000-4000-8000-000000000011',
    'quarterly',
    'Europe/Sofia',
    statement_timestamp() + interval '3 months'
  );

insert into public.task_reminder_recipients (reminder_id, user_id)
select tr.id, '00000000-0000-4000-8000-000000000011'
from public.task_reminders as tr
where tr.created_by = '00000000-0000-4000-8000-000000000011';

do $$
begin
  begin
    insert into public.task_reminders (
      task_id,
      created_by,
      schedule_kind,
      timezone,
      next_run_at
    )
    values (
      '30000000-0000-4000-8000-000000000014',
      '00000000-0000-4000-8000-000000000011',
      'yearly',
      'Europe/Sofia',
      statement_timestamp() + interval '1 year'
    );
    raise exception 'Guest unexpectedly enabled reminders on a fourth task';
  exception
    when raise_exception then
      if sqlerrm not like 'Plan limit reached:%' then
        raise;
      end if;
  end;
end;
$$;

do $$
begin
  begin
    update public.task_reminders
    set email_enabled = true
    where task_id = '30000000-0000-4000-8000-000000000011';
    raise exception 'Guest unexpectedly enabled email reminders';
  exception
    when raise_exception then
      if sqlerrm not like 'The guest plan does not include email reminders%' then
        raise;
      end if;
  end;
end;
$$;

update public.task_reminders
set status = 'paused'
where task_id = '30000000-0000-4000-8000-000000000013';

insert into public.task_reminders (
  task_id,
  created_by,
  schedule_kind,
  timezone,
  next_run_at
)
values (
  '30000000-0000-4000-8000-000000000014',
  '00000000-0000-4000-8000-000000000011',
  'yearly',
  'Europe/Sofia',
  statement_timestamp() + interval '1 year'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000012', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000012","role":"authenticated","is_anonymous":false}',
  true
);

insert into public.workspaces (id, name, slug, created_by)
values (
  '10000000-0000-4000-8000-000000000012',
  'Reminder Free Workspace',
  'reminder-free-workspace',
  '00000000-0000-4000-8000-000000000012'
);

do $$
begin
  if not exists (
    select 1
    from public.workspace_subscriptions
    where workspace_id = '10000000-0000-4000-8000-000000000012'
      and plan_code = 'free'
      and status = 'active'
  ) then
    raise exception 'Expected an active free subscription';
  end if;
end;
$$;

insert into public.projects (
  id,
  workspace_id,
  name,
  visibility,
  status,
  created_by
)
values (
  '20000000-0000-4000-8000-000000000012',
  '10000000-0000-4000-8000-000000000012',
  'Free Reminder Project',
  'workspace',
  'active',
  '00000000-0000-4000-8000-000000000012'
);

insert into public.tasks (id, project_id, status_id, title, created_by)
select
  '30000000-0000-4000-8000-000000000021',
  '20000000-0000-4000-8000-000000000012',
  ts.id,
  'Free email reminder task',
  '00000000-0000-4000-8000-000000000012'
from public.task_statuses as ts
where ts.project_id = '20000000-0000-4000-8000-000000000012'
order by ts.position
limit 1;

insert into public.task_reminders (
  task_id,
  created_by,
  schedule_kind,
  timezone,
  next_run_at,
  email_enabled
)
values (
  '30000000-0000-4000-8000-000000000021',
  '00000000-0000-4000-8000-000000000012',
  'weekly',
  'Europe/Sofia',
  statement_timestamp() + interval '1 week',
  true
);

insert into public.task_reminder_recipients (reminder_id, user_id)
select tr.id, '00000000-0000-4000-8000-000000000012'
from public.task_reminders as tr
where tr.task_id = '30000000-0000-4000-8000-000000000021';

reset role;
set local role service_role;

insert into public.notifications (
  id,
  user_id,
  workspace_id,
  type,
  title
)
values
  (
    '40000000-0000-4000-8000-000000000011',
    '00000000-0000-4000-8000-000000000011',
    '10000000-0000-4000-8000-000000000011',
    'reminder.test',
    'Guest notification'
  ),
  (
    '40000000-0000-4000-8000-000000000012',
    '00000000-0000-4000-8000-000000000012',
    '10000000-0000-4000-8000-000000000012',
    'reminder.test',
    'Free notification'
  );

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000012', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000012","role":"authenticated","is_anonymous":false}',
  true
);

do $$
declare
  affected_rows integer;
  visible_unread_count integer;
begin
  select count(*)
  into visible_unread_count
  from public.notifications
  where read_at is null;

  if visible_unread_count <> 1 then
    raise exception 'Expected unread count to include only the authenticated recipient';
  end if;

  update public.notifications
  set read_at = statement_timestamp()
  where id = '40000000-0000-4000-8000-000000000011';

  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Authenticated user unexpectedly marked another recipient notification as read';
  end if;
end;
$$;

reset role;
set local role service_role;

insert into public.notification_deliveries (
  reminder_id,
  workspace_id,
  user_id,
  scheduled_for,
  next_attempt_at,
  idempotency_key
)
select
  tr.id,
  tr.workspace_id,
  '00000000-0000-4000-8000-000000000012',
  statement_timestamp(),
  statement_timestamp(),
  format('free-email-delivery-%s-unique', occurrence.number)
from public.task_reminders as tr
cross join generate_series(1, 25) as occurrence(number)
where tr.task_id = '30000000-0000-4000-8000-000000000021';

do $$
declare
  target_reminder_id uuid;
begin
  select tr.id
  into target_reminder_id
  from public.task_reminders as tr
  where tr.task_id = '30000000-0000-4000-8000-000000000021';

  begin
    insert into public.notification_deliveries (
      reminder_id,
      workspace_id,
      user_id,
      scheduled_for,
      next_attempt_at,
      idempotency_key
    )
    values (
      target_reminder_id,
      '10000000-0000-4000-8000-000000000012',
      '00000000-0000-4000-8000-000000000012',
      statement_timestamp(),
      statement_timestamp(),
      'free-email-delivery-26-unique'
    );
    raise exception 'Free workspace unexpectedly exceeded its monthly email limit';
  exception
    when raise_exception then
      if sqlerrm not like 'Monthly email limit reached:%' then
        raise;
      end if;
  end;
end;
$$;

rollback;
