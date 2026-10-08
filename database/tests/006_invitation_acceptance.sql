begin;

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000061', 'invite-owner@example.com', '{"display_name":"Invite Owner"}'),
  ('00000000-0000-4000-8000-000000000062', 'invited-member@example.com', '{"display_name":"Invited Member"}'),
  ('00000000-0000-4000-8000-000000000063', 'different-member@example.com', '{"display_name":"Different Member"}');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000061","email":"invite-owner@example.com","role":"authenticated"}',
  true
);

insert into public.workspaces (id, name, slug, created_by)
values (
  '10000000-0000-4000-8000-000000000061',
  'Invitation Test',
  'invitation-test-006',
  '00000000-0000-4000-8000-000000000061'
);

insert into public.invitations (
  id,
  workspace_id,
  email,
  role,
  token_hash,
  invited_by,
  expires_at
)
values (
  '60000000-0000-4000-8000-000000000061',
  '10000000-0000-4000-8000-000000000061',
  'invited-member@example.com',
  'member',
  encode(extensions.digest(repeat('a', 43), 'sha256'), 'hex'),
  '00000000-0000-4000-8000-000000000061',
  statement_timestamp() + interval '7 days'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000062","email":"invited-member@example.com","role":"authenticated"}',
  true
);

select * from public.accept_workspace_invitation(repeat('a', 43));
select * from public.accept_workspace_invitation(repeat('a', 43));

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000061","email":"invite-owner@example.com","role":"authenticated"}',
  true
);

do $$
begin
  if not exists (
    select 1
    from public.workspace_members
    where workspace_id = '10000000-0000-4000-8000-000000000061'
      and user_id = '00000000-0000-4000-8000-000000000062'
      and role = 'member'
  ) then
    raise exception 'Invitation acceptance did not create the expected membership';
  end if;

  if not exists (
    select 1
    from public.invitations
    where id = '60000000-0000-4000-8000-000000000061'
      and status = 'accepted'
      and accepted_by = '00000000-0000-4000-8000-000000000062'
      and accepted_at is not null
  ) then
    raise exception 'Invitation acceptance did not finalize the invitation';
  end if;
end;
$$;

insert into public.invitations (
  id,
  workspace_id,
  email,
  role,
  token_hash,
  invited_by,
  expires_at
)
values (
  '60000000-0000-4000-8000-000000000062',
  '10000000-0000-4000-8000-000000000061',
  'invited-member@example.com',
  'viewer',
  encode(extensions.digest(repeat('b', 43), 'sha256'), 'hex'),
  '00000000-0000-4000-8000-000000000061',
  statement_timestamp() + interval '7 days'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000063","email":"different-member@example.com","role":"authenticated"}',
  true
);

do $$
begin
  begin
    perform public.accept_workspace_invitation(repeat('b', 43));
    raise exception 'A user with a different email accepted the invitation';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'Invitation belongs to a different email address' then
        raise;
      end if;
  end;
end;
$$;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000061","email":"invite-owner@example.com","role":"authenticated"}',
  true
);

do $$
begin
  if exists (
    select 1
    from public.workspace_members
    where workspace_id = '10000000-0000-4000-8000-000000000061'
      and user_id = '00000000-0000-4000-8000-000000000063'
  ) then
    raise exception 'Email mismatch created an unexpected membership';
  end if;
end;
$$;

rollback;
