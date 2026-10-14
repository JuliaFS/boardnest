begin;

insert into auth.users (id, email, is_anonymous, raw_user_meta_data)
values
  (
    '00000000-0000-4000-8000-000000000091',
    'schedule-owner@example.com',
    false,
    '{"display_name":"Schedule Owner"}'
  ),
  (
    '00000000-0000-4000-8000-000000000092',
    'schedule-outsider@example.com',
    false,
    '{"display_name":"Schedule Outsider"}'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000091', true);

insert into public.workspaces (id, name, slug, created_by)
values (
  '10000000-0000-4000-8000-000000000091',
  'Custom Schedule Workspace',
  'custom-schedule-workspace',
  '00000000-0000-4000-8000-000000000091'
);

insert into public.projects (id, workspace_id, name, visibility, status, created_by)
values (
  '20000000-0000-4000-8000-000000000091',
  '10000000-0000-4000-8000-000000000091',
  'Custom Schedule Project',
  'workspace',
  'active',
  '00000000-0000-4000-8000-000000000091'
);

insert into public.tasks (id, project_id, status_id, title, created_by)
select
  '30000000-0000-4000-8000-000000000091',
  '20000000-0000-4000-8000-000000000091',
  status.id,
  'Custom Schedule Task',
  '00000000-0000-4000-8000-000000000091'
from public.task_statuses as status
where status.project_id = '20000000-0000-4000-8000-000000000091'
order by status.position
limit 1;

insert into public.scheduled_notifications (
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
  in_app_enabled,
  email_enabled
)
values (
  '10000000-0000-4000-8000-000000000091',
  '20000000-0000-4000-8000-000000000091',
  '30000000-0000-4000-8000-000000000091',
  '00000000-0000-4000-8000-000000000091',
  'Review release report',
  'Open the task and review the latest report.',
  'interval',
  1,
  'hour',
  'Europe/Sofia',
  '2030-01-15T08:00:00Z',
  true,
  true
);

do $$
begin
  begin
    insert into public.scheduled_notifications (
      workspace_id,
      created_by,
      title,
      schedule_kind,
      interval_value,
      interval_unit,
      timezone,
      next_run_at
    ) values (
      '10000000-0000-4000-8000-000000000091',
      '00000000-0000-4000-8000-000000000091',
      'Too frequent for Free',
      'interval',
      59,
      'minute',
      'UTC',
      '2030-01-15T08:00:00Z'
    );
    raise exception 'Free plan unexpectedly accepted a 59-minute interval'
      using errcode = 'XX000';
  exception
    when sqlstate 'P0001' then null;
    when sqlstate 'XX000' then raise;
  end;
end;
$$;

insert into public.scheduled_notifications (
  workspace_id,
  created_by,
  title,
  schedule_kind,
  timezone,
  next_run_at
)
select
  '10000000-0000-4000-8000-000000000091',
  '00000000-0000-4000-8000-000000000091',
  'Quota schedule ' || sequence_number,
  'once',
  'UTC',
  '2030-01-15T08:00:00Z'::timestamptz + sequence_number * interval '1 day'
from generate_series(1, 9) as series(sequence_number);

do $$
begin
  begin
    insert into public.scheduled_notifications (
      workspace_id,
      created_by,
      title,
      schedule_kind,
      timezone,
      next_run_at
    ) values (
      '10000000-0000-4000-8000-000000000091',
      '00000000-0000-4000-8000-000000000091',
      'Over the Free plan quota',
      'once',
      'UTC',
      '2030-03-01T08:00:00Z'
    );
    raise exception 'Free plan unexpectedly accepted an eleventh active schedule'
      using errcode = 'XX000';
  exception
    when sqlstate 'P0001' then null;
    when sqlstate 'XX000' then raise;
  end;
end;
$$;

update public.scheduled_notifications
set status = 'paused'
where title = 'Quota schedule 1';

insert into public.scheduled_notifications (
  workspace_id,
  created_by,
  title,
  schedule_kind,
  timezone,
  next_run_at
) values (
  '10000000-0000-4000-8000-000000000091',
  '00000000-0000-4000-8000-000000000091',
  'Replacement after pause',
  'once',
  'UTC',
  '2030-03-01T08:00:00Z'
);

do $$
begin
  if not exists (
    select 1
    from public.scheduled_notifications
    where title = 'Review release report'
      and project_id = '20000000-0000-4000-8000-000000000091'
      and task_id = '30000000-0000-4000-8000-000000000091'
      and interval_value = 1
      and interval_unit = 'hour'
  ) then
    raise exception 'Expected the contextual custom schedule to be visible to its owner';
  end if;
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000092', true);

do $$
begin
  if exists (
    select 1
    from public.scheduled_notifications
    where title = 'Review release report'
  ) then
    raise exception 'A non-member read another user''s scheduled notification';
  end if;
end;
$$;

rollback;
