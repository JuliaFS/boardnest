begin;

-- Invitations target accounts before membership exists. The ordinary event
-- producer deliberately requires membership, so this narrow trigger writes
-- recipient-only in-app rows and never queues another invitation email/push.
insert into public.notification_event_types (
  code, display_name, description, category,
  default_in_app_enabled, default_email_enabled, default_push_enabled
) values (
  'workspace.invited', 'Workspace invitation',
  'An invitation to join a workspace.', 'workspace', true, false, false
);

insert into public.plan_notification_events (
  plan_code, event_type, in_app_enabled, email_enabled, push_enabled
)
select code, 'workspace.invited', true, false, false
from public.subscription_plans;

create function private.notify_workspace_invitation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient_id uuid;
  workspace_name text;
  channels record;
begin
  if new.status <> 'pending' or new.expires_at <= statement_timestamp() then
    return new;
  end if;

  select account.id into recipient_id
  from auth.users as account
  where lower(btrim(account.email)) = new.email
    and not coalesce(account.is_anonymous, false);
  if recipient_id is null then return new; end if;

  select * into channels
  from private.notification_event_channels(
    recipient_id, new.workspace_id, 'workspace.invited'
  );
  if not found or not channels.in_app_enabled then return new; end if;

  select workspace.name into workspace_name
  from public.workspaces as workspace where workspace.id = new.workspace_id;

  insert into public.notifications (
    user_id, workspace_id, actor_id, type, title, body, event_key, payload
  ) values (
    recipient_id, new.workspace_id, new.invited_by, 'workspace.invited',
    'Workspace invitation',
    'You have been invited to join ' || workspace_name || ' as '
      || new.role || '. Open this invitation to accept.',
    'workspace-invited:' || new.id::text,
    jsonb_build_object(
      'invitationId', new.id,
      'requestedChannels', jsonb_build_object('inApp', true, 'email', false, 'push', false)
    )
  ) on conflict (user_id, event_key) where event_key is not null do nothing;
  return new;
end;
$$;

revoke execute on function private.notify_workspace_invitation() from public;
create trigger invitations_notify_recipient
after insert on public.invitations
for each row execute function private.notify_workspace_invitation();

create function private.accept_workspace_invitation_id(p_invitation_id uuid)
returns setof public.workspace_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_email text := lower(btrim(coalesce((select auth.jwt()) ->> 'email', '')));
  target_invitation public.invitations%rowtype;
begin
  if actor_id is null or actor_email = ''
    or coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false) then
    raise exception 'Invitation acceptance requires a registered account with an email address'
      using errcode = '42501';
  end if;

  select invitation.*
  into target_invitation
  from public.invitations as invitation
  where invitation.id = p_invitation_id
  for update;

  if not found then
    raise exception 'Invitation token is invalid'
      using errcode = 'P0001';
  end if;

  if lower(target_invitation.email) <> actor_email then
    raise exception 'Invitation belongs to a different email address'
      using errcode = 'P0001';
  end if;

  if target_invitation.status = 'accepted' then
    if target_invitation.accepted_by is distinct from actor_id then
      raise exception 'Invitation has already been accepted'
        using errcode = 'P0001';
    end if;

    return query
    select membership.*
    from public.workspace_members as membership
    where membership.workspace_id = target_invitation.workspace_id
      and membership.user_id = actor_id;
    return;
  end if;

  if target_invitation.status = 'revoked' then
    raise exception 'Invitation has been revoked'
      using errcode = 'P0001';
  end if;

  if target_invitation.status = 'expired'
    or target_invitation.expires_at <= statement_timestamp()
  then
    raise exception 'Invitation has expired'
      using errcode = 'P0001';
  end if;

  if target_invitation.status <> 'pending' then
    raise exception 'Invitation cannot be accepted'
      using errcode = 'P0001';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (target_invitation.workspace_id, actor_id, target_invitation.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.invitations
  set
    accepted_at = statement_timestamp(),
    accepted_by = actor_id,
    status = 'accepted'
  where id = target_invitation.id;

  return query
  select membership.*
  from public.workspace_members as membership
  where membership.workspace_id = target_invitation.workspace_id
    and membership.user_id = actor_id;
end;
$$;

revoke all on function private.accept_workspace_invitation_id(uuid) from public;

create function public.accept_workspace_invitation_by_id(p_invitation_id uuid)
returns setof public.workspace_members
language sql
security definer
set search_path = ''
as $$
  select * from private.accept_workspace_invitation_id(p_invitation_id);
$$;
revoke all on function public.accept_workspace_invitation_by_id(uuid) from public, anon;
grant execute on function public.accept_workspace_invitation_by_id(uuid) to authenticated;

create or replace function public.accept_workspace_invitation(p_token text)
returns setof public.workspace_members
language plpgsql
security definer
set search_path = ''
as $$
declare invitation_id uuid;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    raise exception 'Invitation token is invalid' using errcode = 'P0001';
  end if;
  select id into invitation_id from public.invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  return query select * from private.accept_workspace_invitation_id(invitation_id);
end;
$$;

comment on function public.accept_workspace_invitation_by_id(uuid) is
  'Accepts an invitation by ID only when the authenticated registered account email matches; shares lifecycle checks with email-token acceptance.';

commit;
