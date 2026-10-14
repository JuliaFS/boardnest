begin;

insert into auth.users (id, email, is_anonymous, raw_user_meta_data)
values
  (
    '00000000-0000-4000-8000-000000000071',
    'event-owner@example.com',
    false,
    '{"display_name":"Event Owner"}'
  ),
  (
    '00000000-0000-4000-8000-000000000072',
    'event-member@example.com',
    false,
    '{"display_name":"Event Member"}'
  ),
  (
    '00000000-0000-4000-8000-000000000073',
    null,
    true,
    '{"display_name":"Event Guest"}'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000071', true);

insert into public.workspaces (id, name, slug, created_by)
values (
  '10000000-0000-4000-8000-000000000071',
  'Notification Event Workspace',
  'notification-event-workspace',
  '00000000-0000-4000-8000-000000000071'
);

insert into public.workspace_members (workspace_id, user_id, role)
values (
  '10000000-0000-4000-8000-000000000071',
  '00000000-0000-4000-8000-000000000072',
  'member'
);

insert into public.projects (id, workspace_id, name, visibility, status, created_by)
values (
  '20000000-0000-4000-8000-000000000071',
  '10000000-0000-4000-8000-000000000071',
  'Notification Event Project',
  'workspace',
  'active',
  '00000000-0000-4000-8000-000000000071'
);

insert into public.tasks (id, project_id, status_id, title, created_by)
select
  '30000000-0000-4000-8000-000000000071',
  '20000000-0000-4000-8000-000000000071',
  status.id,
  'Notification Event Task',
  '00000000-0000-4000-8000-000000000071'
from public.task_statuses as status
where status.project_id = '20000000-0000-4000-8000-000000000071'
order by status.position
limit 1;

reset role;
set local role service_role;

do $$
begin
  if (select count(*) from public.notification_event_types) <> 11 then
    raise exception 'Expected eleven canonical notification event types';
  end if;

  if exists (
    select 1 from public.plan_notification_events
    where plan_code = 'guest' and email_enabled
  ) then
    raise exception 'Guest plan unexpectedly includes an email event';
  end if;
end;
$$;

select public.create_notification_event(
  'task-assigned:30000000-0000-4000-8000-000000000071:member',
  '00000000-0000-4000-8000-000000000072',
  '10000000-0000-4000-8000-000000000071',
  'task.assigned',
  'Task assigned',
  'You were assigned to Notification Event Task.',
  '00000000-0000-4000-8000-000000000071',
  '20000000-0000-4000-8000-000000000071',
  '30000000-0000-4000-8000-000000000071',
  null,
  '{"source":"sql-test"}'::jsonb
);

-- A producer retry must not duplicate either channel.
select public.create_notification_event(
  'task-assigned:30000000-0000-4000-8000-000000000071:member',
  '00000000-0000-4000-8000-000000000072',
  '10000000-0000-4000-8000-000000000071',
  'task.assigned',
  'Task assigned',
  'You were assigned to Notification Event Task.',
  '00000000-0000-4000-8000-000000000071',
  '20000000-0000-4000-8000-000000000071',
  '30000000-0000-4000-8000-000000000071',
  null,
  '{"source":"sql-test"}'::jsonb
);

do $$
begin
  if (
    select count(*) from public.notifications
    where event_key = 'task-assigned:30000000-0000-4000-8000-000000000071:member'
  ) <> 1 then
    raise exception 'Expected one idempotent in-app notification';
  end if;

  if (
    select count(*) from public.notification_deliveries
    where payload ->> 'eventType' = 'task.assigned'
      and user_id = '00000000-0000-4000-8000-000000000072'
  ) <> 1 then
    raise exception 'Expected one idempotent email delivery';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000072', true);

insert into public.notification_event_preferences (
  user_id,
  event_type,
  in_app_enabled,
  email_enabled
)
values (
  '00000000-0000-4000-8000-000000000072',
  'task.assigned',
  true,
  false
);

reset role;
set local role service_role;

select public.create_notification_event(
  'task-assigned:30000000-0000-4000-8000-000000000071:no-email',
  '00000000-0000-4000-8000-000000000072',
  '10000000-0000-4000-8000-000000000071',
  'task.assigned',
  'Second assignment',
  null,
  null,
  '20000000-0000-4000-8000-000000000071',
  '30000000-0000-4000-8000-000000000071'
);

do $$
begin
  if not exists (
    select 1 from public.notifications
    where event_key = 'task-assigned:30000000-0000-4000-8000-000000000071:no-email'
  ) then
    raise exception 'Disabling email unexpectedly disabled the in-app event';
  end if;

  if exists (
    select 1 from public.notification_deliveries
    where payload ->> 'title' = 'Second assignment'
  ) then
    raise exception 'Per-event email opt-out was ignored';
  end if;
end;
$$;

-- Email-only preferences queue a delivery without creating an in-app row.
update public.notification_event_preferences
set in_app_enabled = false,
    email_enabled = true
where user_id = '00000000-0000-4000-8000-000000000072'
  and event_type = 'task.assigned';

select public.create_notification_event(
  'task-assigned:30000000-0000-4000-8000-000000000071:email-only',
  '00000000-0000-4000-8000-000000000072',
  '10000000-0000-4000-8000-000000000071',
  'task.assigned',
  'Email-only assignment',
  null,
  null,
  '20000000-0000-4000-8000-000000000071',
  '30000000-0000-4000-8000-000000000071'
);

select public.create_notification_event(
  'task-assigned:30000000-0000-4000-8000-000000000071:email-only',
  '00000000-0000-4000-8000-000000000072',
  '10000000-0000-4000-8000-000000000071',
  'task.assigned',
  'Email-only assignment',
  null,
  null,
  '20000000-0000-4000-8000-000000000071',
  '30000000-0000-4000-8000-000000000071'
);

do $$
begin
  if exists (
    select 1 from public.notifications
    where event_key = 'task-assigned:30000000-0000-4000-8000-000000000071:email-only'
  ) then
    raise exception 'Email-only event unexpectedly created an in-app row';
  end if;

  if (
    select count(*) from public.notification_deliveries
    where payload ->> 'title' = 'Email-only assignment'
  ) <> 1 then
    raise exception 'Expected one idempotent email-only outbox row';
  end if;
end;
$$;

-- Guest plans retain in-app events while the database blocks email fan-out.
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000073', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000073","role":"authenticated","is_anonymous":true}',
  true
);

insert into public.workspaces (id, name, slug, created_by)
values (
  '10000000-0000-4000-8000-000000000073',
  'Notification Guest Workspace',
  'notification-guest-workspace',
  '00000000-0000-4000-8000-000000000073'
);

reset role;
set local role service_role;

select public.create_notification_event(
  'custom-notification:10000000-0000-4000-8000-000000000073:first',
  '00000000-0000-4000-8000-000000000073',
  '10000000-0000-4000-8000-000000000073',
  'custom.notification',
  'Guest custom notification'
);

do $$
begin
  if not exists (
    select 1 from public.notifications
    where event_key = 'custom-notification:10000000-0000-4000-8000-000000000073:first'
  ) then
    raise exception 'Guest in-app notification was not created';
  end if;

  if exists (
    select 1 from public.notification_deliveries
    where workspace_id = '10000000-0000-4000-8000-000000000073'
  ) then
    raise exception 'Guest plan unexpectedly queued an email';
  end if;
end;
$$;

rollback;
