begin;

-- Fixed IDs make failures easy to diagnose and keep the test deterministic.
insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000001', 'owner@example.com', '{"display_name":"Owner"}'),
  ('00000000-0000-4000-8000-000000000002', 'member@example.com', '{"display_name":"Member"}'),
  ('00000000-0000-4000-8000-000000000003', 'outsider@example.com', '{"display_name":"Outsider"}');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

insert into public.workspaces (id, name, slug, created_by)
values (
  '10000000-0000-4000-8000-000000000001',
  'Boardnest Test',
  'boardnest-test',
  '00000000-0000-4000-8000-000000000001'
);

insert into public.workspace_members (workspace_id, user_id, role)
values (
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'member'
);

insert into public.projects (id, workspace_id, name, visibility, status, created_by)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Visible Project',
    'workspace',
    'active',
    '00000000-0000-4000-8000-000000000001'
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'Private Project',
    'private',
    'planned',
    '00000000-0000-4000-8000-000000000001'
  );

do $$
begin
  if (
    select count(*)
    from public.task_statuses
    where project_id in (
      '20000000-0000-4000-8000-000000000001',
      '20000000-0000-4000-8000-000000000002'
    )
  ) <> 8 then
    raise exception 'Expected four default statuses for each project';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);

do $$
begin
  if (select count(*) from public.projects) <> 1 then
    raise exception 'Workspace member must initially see only the workspace-visible project';
  end if;
end;
$$;

do $$
declare
  affected_rows integer;
begin
  update public.projects
  set visibility = 'private'
  where id = '20000000-0000-4000-8000-000000000001';

  get diagnostics affected_rows = row_count;

  if affected_rows <> 0 then
    raise exception 'Member unexpectedly changed project visibility';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

insert into public.project_members (project_id, workspace_id, user_id, role)
values (
  '20000000-0000-4000-8000-000000000002',
  '10000000-0000-4000-8000-000000000001',
  '00000000-0000-4000-8000-000000000002',
  'member'
);

update public.projects
set status = 'on_hold'
where id = '20000000-0000-4000-8000-000000000002';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);

do $$
begin
  if (select count(*) from public.projects) <> 2 then
    raise exception 'Explicit project member must see the private project';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

delete from public.project_members
where project_id = '20000000-0000-4000-8000-000000000002'
  and user_id = '00000000-0000-4000-8000-000000000002';

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);

do $$
begin
  if (select count(*) from public.projects) <> 1 then
    raise exception 'Removed project member retained private project access';
  end if;
end;
$$;

reset role;

do $$
begin
  begin
    delete from public.workspace_members
    where workspace_id = '10000000-0000-4000-8000-000000000001'
      and user_id = '00000000-0000-4000-8000-000000000001';
    raise exception 'Last workspace owner was unexpectedly removed';
  exception
    when check_violation then null;
  end;
end;
$$;

rollback;
