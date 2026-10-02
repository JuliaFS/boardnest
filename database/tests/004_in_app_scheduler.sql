begin;

insert into auth.users (id, email, is_anonymous, raw_user_meta_data)
values (
  '00000000-0000-4000-8000-000000000041',
  'scheduler-owner@example.com',
  false,
  '{"display_name":"Scheduler Owner"}'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000041', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000041","role":"authenticated","is_anonymous":false}',
  true
);

insert into public.workspaces (id, name, slug, created_by)
values (
  '10000000-0000-4000-8000-000000000041',
  'Scheduler Workspace',
  'scheduler-workspace',
  '00000000-0000-4000-8000-000000000041'
);

insert into public.projects (id, workspace_id, name, visibility, status, created_by)
values (
  '20000000-0000-4000-8000-000000000041',
  '10000000-0000-4000-8000-000000000041',
  'Scheduler Project',
  'workspace',
  'active',
  '00000000-0000-4000-8000-000000000041'
);

insert into public.tasks (id, project_id, status_id, title, created_by)
select
  task_data.id,
  '20000000-0000-4000-8000-000000000041',
  task_status.id,
  task_data.title,
  '00000000-0000-4000-8000-000000000041'
from (
  values
    ('30000000-0000-4000-8000-000000000041'::uuid, 'Weekly scheduler task'),
    ('30000000-0000-4000-8000-000000000042'::uuid, 'One-time scheduler task')
) as task_data(id, title)
cross join lateral (
  select status.id
  from public.task_statuses as status
  where status.project_id = '20000000-0000-4000-8000-000000000041'
  order by status.position
  limit 1
) as task_status;

-- 10:00 Europe/Sofia before DST. The next weekly occurrence must remain at
-- 10:00 local time even though its UTC value changes after the DST boundary.
select *
from public.create_task_reminder_with_recipients(
  '30000000-0000-4000-8000-000000000041',
  'weekly',
  'Europe/Sofia',
  '2027-03-21 08:00:00+00',
  null,
  true,
  true,
  true,
  array['00000000-0000-4000-8000-000000000041'::uuid]
);

select *
from public.create_task_reminder_with_recipients(
  '30000000-0000-4000-8000-000000000042',
  'once',
  'UTC',
  '2027-03-21 08:30:00+00',
  null,
  true,
  false,
  true,
  array['00000000-0000-4000-8000-000000000041'::uuid]
);

reset role;
set local role service_role;

do $$
declare
  processed integer;
begin
  processed := public.process_due_task_reminders(
    100,
    '2027-03-21 09:00:00+00'
  );
  if processed <> 2 then
    raise exception 'Expected two due reminders, processed %', processed;
  end if;

  if public.process_due_task_reminders(
    100,
    '2027-03-21 09:00:00+00'
  ) <> 0 then
    raise exception 'The same reminder occurrence was processed twice';
  end if;
end;
$$;

reset role;

do $$
begin
  if (
    select count(*)
    from public.notifications
    where user_id = '00000000-0000-4000-8000-000000000041'
      and type = 'task.reminder'
  ) <> 2 then
    raise exception 'Expected one in-app notification per due reminder';
  end if;

  if (
    select count(*)
    from public.notification_deliveries
    where user_id = '00000000-0000-4000-8000-000000000041'
  ) <> 1 then
    raise exception 'Expected one email outbox row for the email-enabled reminder';
  end if;

  if not exists (
    select 1
    from public.task_reminders
    where task_id = '30000000-0000-4000-8000-000000000041'
      and status = 'active'
      and last_run_at = '2027-03-21 08:00:00+00'
      and next_run_at = '2027-03-28 07:00:00+00'
  ) then
    raise exception 'Weekly recurrence did not preserve its local time across DST';
  end if;

  if not exists (
    select 1
    from public.task_reminders
    where task_id = '30000000-0000-4000-8000-000000000042'
      and status = 'completed'
      and last_run_at = '2027-03-21 08:30:00+00'
  ) then
    raise exception 'One-time reminder was not completed after processing';
  end if;
end;
$$;

rollback;
