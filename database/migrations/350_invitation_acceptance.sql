begin;

create function public.accept_workspace_invitation(p_token text)
returns setof public.workspace_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_email text := lower(btrim(coalesce((select auth.jwt()) ->> 'email', '')));
  token_hash text;
  target_invitation public.invitations%rowtype;
begin
  if actor_id is null or actor_email = '' then
    raise exception 'Invitation acceptance requires a registered account with an email address'
      using errcode = '42501';
  end if;

  if p_token is null
    or char_length(p_token) <> 43
    or p_token !~ '^[A-Za-z0-9_-]{43}$'
  then
    raise exception 'Invitation token is invalid'
      using errcode = 'P0001';
  end if;

  token_hash := encode(extensions.digest(p_token, 'sha256'), 'hex');

  select invitation.*
  into target_invitation
  from public.invitations as invitation
  where invitation.token_hash = token_hash
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

revoke all on function public.accept_workspace_invitation(text)
from public, anon;
grant execute on function public.accept_workspace_invitation(text)
to authenticated;

comment on function public.accept_workspace_invitation(text) is
  'Atomically accepts an unexpired invitation when its normalized email matches the authenticated JWT email.';

commit;
