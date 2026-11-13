begin;

insert into auth.users (id, email, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000141', 'invitation-owner@example.com', '{"display_name":"Owner"}'),
  ('00000000-0000-4000-8000-000000000142', 'invitation-recipient@example.com', '{"display_name":"Recipient"}'),
  ('00000000-0000-4000-8000-000000000143', 'invitation-other@example.com', '{"display_name":"Other"}');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000141","email":"invitation-owner@example.com","role":"authenticated"}', true);
insert into public.workspaces (id, name, slug, created_by)
values ('10000000-0000-4000-8000-000000000141', 'Invited workspace', 'invite-notification-014', '00000000-0000-4000-8000-000000000141');

insert into public.invitations (id, workspace_id, email, role, token_hash, invited_by, expires_at)
values
  ('60000000-0000-4000-8000-000000000141', '10000000-0000-4000-8000-000000000141', 'invitation-recipient@example.com', 'member', encode(extensions.digest(repeat('a', 43), 'sha256'), 'hex'), '00000000-0000-4000-8000-000000000141', statement_timestamp() + interval '7 days'),
  ('60000000-0000-4000-8000-000000000142', '10000000-0000-4000-8000-000000000141', 'not-registered@example.com', 'member', encode(extensions.digest(repeat('b', 43), 'sha256'), 'hex'), '00000000-0000-4000-8000-000000000141', statement_timestamp() + interval '7 days');

-- An unrelated authenticated user cannot read or accept the invitation.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000143","email":"invitation-other@example.com","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from public.notifications where type = 'workspace.invited') then
    raise exception 'Invitation notification leaked to another user';
  end if;
  begin
    perform public.accept_workspace_invitation_by_id('60000000-0000-4000-8000-000000000141');
    raise exception 'Another email accepted the invitation';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Invitation belongs to a different email address' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000142","email":"invitation-recipient@example.com","role":"authenticated"}', true);
do $$
begin
  if (select count(*) from public.notifications where type = 'workspace.invited') <> 1 then
    raise exception 'Expected one recipient-only invitation notification before membership';
  end if;
  if not exists (
    select 1 from public.notifications
    where type = 'workspace.invited' and read_at is null
      and payload ->> 'invitationId' = '60000000-0000-4000-8000-000000000141'
      and not (payload ? 'token') and not (payload ? 'token_hash')
  ) then raise exception 'Invitation notification context is invalid'; end if;
  if exists (select 1 from public.workspace_members where workspace_id = '10000000-0000-4000-8000-000000000141') then
    raise exception 'Receiving a notification granted workspace access';
  end if;
end;
$$;

select * from public.accept_workspace_invitation_by_id('60000000-0000-4000-8000-000000000141');
select * from public.accept_workspace_invitation_by_id('60000000-0000-4000-8000-000000000141');
-- An email link remains reusable by the same recipient after ID acceptance.
select * from public.accept_workspace_invitation(repeat('a', 43));

reset role;
do $$
begin
  if not exists (
    select 1 from public.workspace_members
    where workspace_id = '10000000-0000-4000-8000-000000000141'
      and user_id = '00000000-0000-4000-8000-000000000142' and role = 'member'
  ) then raise exception 'ID acceptance did not create membership'; end if;
  if exists (
    select 1 from public.notification_deliveries as delivery
    join public.notifications as notification on notification.id = delivery.notification_id
    where notification.type = 'workspace.invited'
  ) then raise exception 'In-app invitation queued duplicate email or push delivery'; end if;
end;
$$;

-- Opting out of in-app notifications suppresses this event as well.
update public.notification_preferences set in_app_enabled = false
where user_id = '00000000-0000-4000-8000-000000000143';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000141","email":"invitation-owner@example.com","role":"authenticated"}', true);
insert into public.invitations (id, workspace_id, email, role, token_hash, invited_by, expires_at)
values ('60000000-0000-4000-8000-000000000143', '10000000-0000-4000-8000-000000000141', 'invitation-other@example.com', 'viewer', encode(extensions.digest(repeat('c', 43), 'sha256'), 'hex'), '00000000-0000-4000-8000-000000000141', statement_timestamp() + interval '7 days');
update public.invitations set status = 'revoked', revoked_at = statement_timestamp()
where id = '60000000-0000-4000-8000-000000000143';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000143","email":"invitation-other@example.com","role":"authenticated"}', true);
do $$
begin
  if exists (select 1 from public.notifications where type = 'workspace.invited') then
    raise exception 'In-app opt-out was ignored';
  end if;
  begin
    perform public.accept_workspace_invitation_by_id('60000000-0000-4000-8000-000000000143');
    raise exception 'Revoked invitation was accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Invitation has been revoked' then raise; end if;
  end;
end;
$$;

reset role;
update public.invitations set status = 'expired', revoked_at = null
where id = '60000000-0000-4000-8000-000000000143';
set local role authenticated;
do $$
begin
  begin
    perform public.accept_workspace_invitation_by_id('60000000-0000-4000-8000-000000000143');
    raise exception 'Expired invitation was accepted';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'Invitation has expired' then raise; end if;
  end;
end;
$$;
reset role;
set local role anon;
do $$
begin
  begin
    perform public.accept_workspace_invitation_by_id('60000000-0000-4000-8000-000000000141');
    raise exception 'Anonymous role can execute invitation acceptance';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
set local role authenticated;
do $$
begin
  begin
    perform private.accept_workspace_invitation_id('60000000-0000-4000-8000-000000000141');
    raise exception 'Private invitation helper is exposed';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
