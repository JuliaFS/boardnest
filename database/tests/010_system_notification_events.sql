begin;

insert into auth.users (id, email, is_anonymous, raw_user_meta_data)
values
  (
    '00000000-0000-4000-8000-000000000101',
    'system-events-owner@example.com',
    false,
    '{"display_name":"System Events Owner"}'
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    'system-events-member@example.com',
    false,
    '{"display_name":"System Events Member"}'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000101', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated","is_anonymous":false}',
  true
);

insert into public.workspaces (id, name, slug, created_by)
values (
  '10000000-0000-4000-8000-000000000101',
  'System Event Workspace',
  'system-event-workspace',
  '00000000-0000-4000-8000-000000000101'
);

insert into public.workspace_members (workspace_id, user_id, role)
values (
  '10000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102',
  'member'
);

insert into public.projects (id, workspace_id, name, visibility, status, created_by)
values (
  '20000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000101',
  'System Event Project',
  'workspace',
  'active',
  '00000000-0000-4000-8000-000000000101'
);

insert into public.project_members (project_id, workspace_id, user_id, role)
values (
  '20000000-0000-4000-8000-000000000101',
  '10000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102',
  'member'
);

insert into public.tasks (id, project_id, status_id, title, created_by)
select
  '30000000-0000-4000-8000-000000000101',
  '20000000-0000-4000-8000-000000000101',
  status.id,
  'System Event Task',
  '00000000-0000-4000-8000-000000000101'
from public.task_statuses as status
where status.project_id = '20000000-0000-4000-8000-000000000101'
order by status.position
limit 1;

insert into public.task_assignees (task_id, user_id, assigned_by)
values (
  '30000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000102',
  '00000000-0000-4000-8000-000000000101'
);

update public.tasks
set title = 'Updated System Event Task'
where id = '30000000-0000-4000-8000-000000000101';

update public.tasks
set status_id = (
  select status.id
  from public.task_statuses as status
  where status.project_id = '20000000-0000-4000-8000-000000000101'
  order by status.position
  offset 1 limit 1
)
where id = '30000000-0000-4000-8000-000000000101';

insert into public.task_comments (id, task_id, author_id, body)
values (
  '40000000-0000-4000-8000-000000000101',
  '30000000-0000-4000-8000-000000000101',
  '00000000-0000-4000-8000-000000000101',
  'System event coverage comment.'
);

select *
from public.create_task_reminder_with_recipients(
  '30000000-0000-4000-8000-000000000101',
  'once',
  'UTC',
  '2031-01-15 09:00:00+00',
  null,
  true,
  true,
  true,
  array['00000000-0000-4000-8000-000000000102'::uuid]
);

reset role;
set local role service_role;

select public.process_due_task_reminders(10, '2031-01-15 10:00:00+00');

do $$
declare
  expected_type text;
begin
  foreach expected_type in array array[
    'workspace.member_added',
    'project.member_added',
    'task.created',
    'task.assigned',
    'task.updated',
    'task.status_changed',
    'comment.created',
    'task.reminder'
  ]
  loop
    if (
      select count(*)
      from public.notifications
      where user_id = '00000000-0000-4000-8000-000000000102'
        and type = expected_type
    ) <> 1 then
      raise exception 'Expected exactly one % notification for the member', expected_type;
    end if;
  end loop;

  if exists (
    select 1
    from public.notifications
    where user_id = '00000000-0000-4000-8000-000000000101'
      and type in ('task.created', 'task.updated', 'task.status_changed', 'comment.created')
  ) then
    raise exception 'The actor received a broadcast notification for their own action';
  end if;

  if (
    select count(*)
    from public.notification_deliveries
    where user_id = '00000000-0000-4000-8000-000000000102'
      and reminder_id in (
        select reminder.id
        from public.task_reminders as reminder
        where reminder.task_id = '30000000-0000-4000-8000-000000000101'
      )
  ) <> 1 then
    raise exception 'Expected one reminder email delivery before event opt-out';
  end if;
end;
$$;

insert into public.notification_event_preferences (
  user_id,
  event_type,
  in_app_enabled,
  email_enabled
)
values (
  '00000000-0000-4000-8000-000000000102',
  'task.reminder',
  false,
  false
);

reset role;
set local role authenticated;

select *
from public.create_task_reminder_with_recipients(
  '30000000-0000-4000-8000-000000000101',
  'once',
  'UTC',
  '2031-01-15 11:00:00+00',
  null,
  true,
  true,
  true,
  array['00000000-0000-4000-8000-000000000102'::uuid]
);

reset role;
set local role service_role;

select public.process_due_task_reminders(10, '2031-01-15 12:00:00+00');

do $$
begin
  if (
    select count(*)
    from public.notifications
    where user_id = '00000000-0000-4000-8000-000000000102'
      and type = 'task.reminder'
  ) <> 1 then
    raise exception 'Reminder in-app event opt-out was ignored';
  end if;

  if (
    select count(*)
    from public.notification_deliveries
    where user_id = '00000000-0000-4000-8000-000000000102'
      and reminder_id in (
        select reminder.id
        from public.task_reminders as reminder
        where reminder.task_id = '30000000-0000-4000-8000-000000000101'
      )
  ) <> 1 then
    raise exception 'Reminder email event opt-out was ignored';
  end if;
end;
$$;

reset role;
set local role authenticated;

delete from public.project_members
where project_id = '20000000-0000-4000-8000-000000000101'
  and user_id = '00000000-0000-4000-8000-000000000102';

reset role;
set local role service_role;

do $$
begin
  if (
    select count(*)
    from public.notifications
    where user_id = '00000000-0000-4000-8000-000000000102'
      and type = 'project.member_removed'
  ) <> 1 then
    raise exception 'Expected one project membership removal notification';
  end if;
end;
$$;

reset role;
set local role authenticated;

delete from public.workspace_members
where workspace_id = '10000000-0000-4000-8000-000000000101'
  and user_id = '00000000-0000-4000-8000-000000000102';

reset role;
set local role service_role;

do $$
begin
  if (
    select count(*)
    from public.notifications
    where user_id = '00000000-0000-4000-8000-000000000101'
      and type = 'workspace.member_removed'
      and payload ->> 'memberId' = '00000000-0000-4000-8000-000000000102'
  ) <> 1 then
    raise exception 'Expected one workspace removal notification for the remaining owner';
  end if;

  if exists (
    select 1
    from public.notifications
    where user_id = '00000000-0000-4000-8000-000000000102'
      and workspace_id = '10000000-0000-4000-8000-000000000101'
  ) then
    raise exception 'Removed workspace member retained private notification data';
  end if;
end;
$$;

rollback;
