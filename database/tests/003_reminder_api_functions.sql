begin;

insert into auth.users (id, email, is_anonymous, raw_user_meta_data)
values
  (
    '00000000-0000-4000-8000-000000000031',
    'reminder-api-owner@example.com',
    false,
    '{"display_name":"Reminder API Owner"}'
  ),
  (
    '00000000-0000-4000-8000-000000000032',
    'reminder-api-outsider@example.com',
    false,
    '{"display_name":"Reminder API Outsider"}'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000031', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000031","role":"authenticated","is_anonymous":false}',
  true
);

insert into public.workspaces (id, name, slug, created_by)
values (
  '10000000-0000-4000-8000-000000000031',
  'Reminder API Workspace',
  'reminder-api-workspace',
  '00000000-0000-4000-8000-000000000031'
);

insert into public.projects (id, workspace_id, name, visibility, status, created_by)
values (
  '20000000-0000-4000-8000-000000000031',
  '10000000-0000-4000-8000-000000000031',
  'Reminder API Project',
  'workspace',
  'active',
  '00000000-0000-4000-8000-000000000031'
);

insert into public.tasks (id, project_id, status_id, title, created_by)
select
  '30000000-0000-4000-8000-000000000031',
  '20000000-0000-4000-8000-000000000031',
  ts.id,
  'Atomic reminder task',
  '00000000-0000-4000-8000-000000000031'
from public.task_statuses as ts
where ts.project_id = '20000000-0000-4000-8000-000000000031'
order by ts.position
limit 1;

select *
from public.create_task_reminder_with_recipients(
  '30000000-0000-4000-8000-000000000031',
  'weekly',
  'Europe/Sofia',
  statement_timestamp() + interval '1 week',
  null,
  true,
  true,
  true,
  array['00000000-0000-4000-8000-000000000031'::uuid]
);

do $$
begin
  if (
    select count(*)
    from public.task_reminders as tr
    join public.task_reminder_recipients as recipient
      on recipient.reminder_id = tr.id
    where tr.task_id = '30000000-0000-4000-8000-000000000031'
      and recipient.user_id = '00000000-0000-4000-8000-000000000031'
  ) <> 1 then
    raise exception 'Expected atomic reminder and recipient creation';
  end if;
end;
$$;

do $$
declare
  target_reminder_id uuid;
begin
  select tr.id
  into target_reminder_id
  from public.task_reminders as tr
  where tr.task_id = '30000000-0000-4000-8000-000000000031';

  begin
    perform public.replace_task_reminder_recipients(
      target_reminder_id,
      array['00000000-0000-4000-8000-000000000032'::uuid]
    );
    raise exception 'Unexpectedly accepted a recipient unrelated to the task';
  exception
    when check_violation then
      null;
  end;

  if not exists (
    select 1
    from public.task_reminder_recipients as recipient
    where recipient.reminder_id = target_reminder_id
      and recipient.user_id = '00000000-0000-4000-8000-000000000031'
  ) then
    raise exception 'Failed recipient replacement did not roll back atomically';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000032', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000032","role":"authenticated","is_anonymous":false}',
  true
);

do $$
begin
  begin
    perform public.create_task_reminder_with_recipients(
      '30000000-0000-4000-8000-000000000031',
      'monthly',
      'UTC',
      statement_timestamp() + interval '1 month',
      null,
      true,
      false,
      true,
      array['00000000-0000-4000-8000-000000000032'::uuid]
    );
    raise exception 'Outsider unexpectedly created a reminder';
  exception
    when insufficient_privilege then
      null;
  end;
end;
$$;

rollback;
