begin;

insert into auth.users (id, email, is_anonymous, raw_user_meta_data)
values
  (
    '00000000-0000-4000-8000-000000000051',
    'delete-owner@example.com',
    false,
    '{"display_name":"Delete Owner"}'
  ),
  (
    '00000000-0000-4000-8000-000000000052',
    'next-owner@example.com',
    false,
    '{"display_name":"Next Owner"}'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000051', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000051","role":"authenticated","is_anonymous":false}',
  true
);

insert into public.workspaces (id, name, slug, created_by)
values
  (
    '10000000-0000-4000-8000-000000000051',
    'Personal deletion workspace',
    'personal-deletion-workspace',
    '00000000-0000-4000-8000-000000000051'
  ),
  (
    '10000000-0000-4000-8000-000000000052',
    'Transfer deletion workspace',
    'transfer-deletion-workspace',
    '00000000-0000-4000-8000-000000000051'
  ),
  (
    '10000000-0000-4000-8000-000000000053',
    'Shared owner deletion workspace',
    'shared-owner-deletion-workspace',
    '00000000-0000-4000-8000-000000000051'
  );

insert into public.workspace_members (workspace_id, user_id, role)
values
  (
    '10000000-0000-4000-8000-000000000052',
    '00000000-0000-4000-8000-000000000052',
    'member'
  ),
  (
    '10000000-0000-4000-8000-000000000053',
    '00000000-0000-4000-8000-000000000052',
    'owner'
  );

insert into public.projects (id, workspace_id, name, visibility, status, created_by)
values
  (
    '20000000-0000-4000-8000-000000000051',
    '10000000-0000-4000-8000-000000000051',
    'Deleted personal project',
    'workspace',
    'active',
    '00000000-0000-4000-8000-000000000051'
  ),
  (
    '20000000-0000-4000-8000-000000000052',
    '10000000-0000-4000-8000-000000000052',
    'Preserved shared project',
    'workspace',
    'active',
    '00000000-0000-4000-8000-000000000051'
  );

reset role;
set local role service_role;

do $$
declare
  impact jsonb;
begin
  impact := public.account_deletion_impact(
    '00000000-0000-4000-8000-000000000051'
  );

  if jsonb_array_length(impact -> 'ownedWorkspaces') <> 3 then
    raise exception 'Expected all three owned workspaces in deletion impact';
  end if;

  begin
    perform public.prepare_account_deletion(
      '00000000-0000-4000-8000-000000000051',
      '{}'::jsonb,
      '{}'::uuid[]
    );
    raise exception 'Deletion unexpectedly continued without required decisions'
      using errcode = 'XX000';
  exception when raise_exception then
    null;
  when sqlstate 'XX000' then
    raise;
  end;

  perform public.prepare_account_deletion(
    '00000000-0000-4000-8000-000000000051',
    jsonb_build_object(
      '10000000-0000-4000-8000-000000000052',
      '00000000-0000-4000-8000-000000000052'
    ),
    array['10000000-0000-4000-8000-000000000051'::uuid]
  );
end;
$$;

reset role;

-- Supabase Auth performs this final delete after the preparation RPC succeeds.
delete from auth.users
where id = '00000000-0000-4000-8000-000000000051';

do $$
begin
  if exists (
    select 1 from public.workspaces
    where id = '10000000-0000-4000-8000-000000000051'
  ) then
    raise exception 'Confirmed personal workspace was not deleted';
  end if;

  if not exists (
    select 1
    from public.workspace_members
    where workspace_id = '10000000-0000-4000-8000-000000000052'
      and user_id = '00000000-0000-4000-8000-000000000052'
      and role = 'owner'
  ) then
    raise exception 'Shared workspace ownership was not transferred';
  end if;

  if exists (
    select 1 from public.workspace_members
    where user_id = '00000000-0000-4000-8000-000000000051'
  ) then
    raise exception 'Deleted user retained a workspace membership';
  end if;

  if not exists (
    select 1
    from public.projects
    where id = '20000000-0000-4000-8000-000000000052'
      and created_by is null
  ) then
    raise exception 'Shared project was not preserved and anonymized';
  end if;

  if exists (
    select 1 from public.profiles
    where id = '00000000-0000-4000-8000-000000000051'
  ) then
    raise exception 'Profile was not removed with the Auth user';
  end if;
end;
$$;

rollback;
