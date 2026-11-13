begin;

-- Replacement is atomic: a conflict or failed insert leaves the old invitation
-- pending and its original acceptance link usable.
create function public.change_workspace_invitation_email(
  p_invitation_id uuid, p_email text, p_token_hash text
)
returns setof public.invitations
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  original public.invitations%rowtype;
  normalized_email text := lower(btrim(p_email));
begin
  if actor_id is null or private.is_anonymous_user() then
    raise exception 'A registered workspace administrator is required'
      using errcode = '42501';
  end if;

  select * into original from public.invitations
  where id = p_invitation_id for update;
  if not found or not private.can_manage_workspace(original.workspace_id) then
    raise exception 'Invitation not found or access denied' using errcode = '42501';
  end if;
  if original.status <> 'pending' or original.expires_at <= statement_timestamp() then
    raise exception 'Only unexpired pending invitations can be changed' using errcode = 'P0001';
  end if;
  if normalized_email = original.email then
    raise exception 'Enter a different email address' using errcode = '22023';
  end if;
  if normalized_email is null or char_length(normalized_email) not between 3 and 320
    or normalized_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Enter a valid email address' using errcode = '22023';
  end if;
  if p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$'
    or p_token_hash = original.token_hash then
    raise exception 'A new invitation token is required' using errcode = '22023';
  end if;

  update public.invitations
  set status = 'revoked', revoked_at = statement_timestamp()
  where id = original.id;

  return query insert into public.invitations (
    workspace_id, email, role, token_hash, invited_by, expires_at
  ) values (
    original.workspace_id, normalized_email, original.role, p_token_hash,
    actor_id, statement_timestamp() + interval '7 days'
  ) returning *;
end;
$$;

revoke all on function public.change_workspace_invitation_email(uuid, text, text)
from public, anon;
grant execute on function public.change_workspace_invitation_email(uuid, text, text)
to authenticated;

commit;
