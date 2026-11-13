begin;
insert into auth.users (id, email) values
 ('00000000-0000-4000-8000-000000000151', 'change-owner@example.com'),
 ('00000000-0000-4000-8000-000000000152', 'change-old@example.com'),
 ('00000000-0000-4000-8000-000000000153', 'change-new@example.com');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000151","email":"change-owner@example.com","role":"authenticated"}', true);
insert into public.workspaces (id, name, slug, created_by) values
 ('10000000-0000-4000-8000-000000000151', 'Change invitation', 'change-invitation-015', '00000000-0000-4000-8000-000000000151');
insert into public.invitations (id, workspace_id, email, role, token_hash, invited_by, expires_at) values
 ('60000000-0000-4000-8000-000000000151', '10000000-0000-4000-8000-000000000151', 'change-old@example.com', 'viewer', encode(extensions.digest(repeat('a',43),'sha256'),'hex'), '00000000-0000-4000-8000-000000000151', statement_timestamp()+interval '7 days'),
 ('60000000-0000-4000-8000-000000000152', '10000000-0000-4000-8000-000000000151', 'change-new@example.com', 'member', encode(extensions.digest(repeat('b',43),'sha256'),'hex'), '00000000-0000-4000-8000-000000000151', statement_timestamp()+interval '7 days');

do $$
begin
  begin
    perform public.change_workspace_invitation_email('60000000-0000-4000-8000-000000000151', 'change-old@example.com', repeat('c',64));
    raise exception 'Unchanged email was accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.change_workspace_invitation_email('60000000-0000-4000-8000-000000000151', 'change-new@example.com', repeat('c',64));
    raise exception 'Duplicate pending invitation was accepted';
  exception when unique_violation then null; end;
  if not exists (select 1 from public.invitations where id='60000000-0000-4000-8000-000000000151' and status='pending') then
    raise exception 'Failed replacement revoked the original invitation';
  end if;
end;
$$;

-- An invited recipient is not authorized to change the destination.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000152","email":"change-old@example.com","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.change_workspace_invitation_email('60000000-0000-4000-8000-000000000151', 'other@example.com', repeat('d',64));
    raise exception 'Non-admin changed the invitation';
  exception when insufficient_privilege then null; end;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000151","email":"change-owner@example.com","role":"authenticated"}', true);
update public.invitations set status='revoked', revoked_at=statement_timestamp() where id='60000000-0000-4000-8000-000000000152';
select * from public.change_workspace_invitation_email('60000000-0000-4000-8000-000000000151', ' CHANGE-NEW@example.com ', encode(extensions.digest(repeat('c',43),'sha256'),'hex'));

do $$
begin
  if not exists (select 1 from public.invitations where id='60000000-0000-4000-8000-000000000151' and status='revoked') then
    raise exception 'Original invitation was not revoked';
  end if;
  if (select count(*) from public.invitations where email='change-new@example.com' and status='pending' and role='viewer') <> 1 then
    raise exception 'Replacement email or role is incorrect';
  end if;
  begin
    perform public.change_workspace_invitation_email('60000000-0000-4000-8000-000000000151', 'other@example.com', repeat('e',64));
    raise exception 'Revoked invitation could be changed';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Only unexpired pending invitations can be changed' then raise; end if;
  end;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000152","email":"change-old@example.com","role":"authenticated"}', true);
do $$
begin
  begin
    perform public.accept_workspace_invitation(repeat('a',43));
    raise exception 'Original token is still usable';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Invitation has been revoked' then raise; end if;
  end;
end;
$$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000153","email":"change-new@example.com","role":"authenticated"}', true);
do $$
begin
  if not exists (
    select 1 from public.notifications n
    where n.type='workspace.invited' and n.payload->>'invitationId' not in
      ('60000000-0000-4000-8000-000000000151','60000000-0000-4000-8000-000000000152')
  ) then raise exception 'Replacement recipient did not receive a notification'; end if;
end;
$$;
select * from public.accept_workspace_invitation(repeat('c',43));
rollback;
