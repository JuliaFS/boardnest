begin;

-- Creator attribution must not turn into permanent account ownership. Actual
-- workspace ownership is represented by workspace_members.role.
alter table public.workspaces
  drop constraint workspaces_created_by_fkey,
  alter column created_by drop not null,
  add constraint workspaces_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null;

alter table public.projects
  drop constraint projects_created_by_fkey,
  alter column created_by drop not null,
  add constraint projects_created_by_fkey
    foreign key (created_by) references public.profiles (id) on delete set null;

-- The original boundary trigger intentionally makes creator attribution
-- immutable. Preserve that guarantee while allowing the FK action to
-- anonymize a project after its creator profile has been removed.
create or replace function private.protect_project_boundaries()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.id, new.workspace_id) is distinct from (old.id, old.workspace_id)
    or (
      new.created_by is distinct from old.created_by
      and not (
        old.created_by is not null
        and new.created_by is null
        and not exists (
          select 1 from public.profiles where id = old.created_by
        )
      )
    )
  then
    raise exception 'Project identity, workspace, and creator cannot be changed'
      using errcode = '23514';
  end if;

  if new.visibility is distinct from old.visibility
    and (select auth.uid()) is not null
    and not exists (
      select 1
      from public.workspace_members as wm
      where wm.workspace_id = old.workspace_id
        and wm.user_id = (select auth.uid())
        and wm.role in ('owner', 'admin')
    )
  then
    raise exception 'Only workspace owners and admins can change project visibility'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Accepted invitations remain useful audit records after an account is
-- removed. accepted_at records the event even when the actor is anonymized.
alter table public.invitations
  drop constraint invitations_accepted_by_fkey,
  drop constraint invitations_state_check,
  add constraint invitations_accepted_by_fkey
    foreign key (accepted_by) references public.profiles (id) on delete set null,
  add constraint invitations_state_check
    check (
      (status = 'pending' and accepted_by is null and accepted_at is null and revoked_at is null)
      or (status = 'accepted' and accepted_at is not null and revoked_at is null)
      or (status = 'revoked' and accepted_by is null and accepted_at is null and revoked_at is not null)
      or (status = 'expired' and accepted_by is null and accepted_at is null and revoked_at is null)
    );

create function public.account_deletion_impact(p_user_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'userId', p_user_id,
    'ownedWorkspaces', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', workspace.id,
          'name', workspace.name,
          'memberCount', workspace.member_count,
          'projectCount', workspace.project_count,
          'taskCount', workspace.task_count,
          'ownershipStatus', case
            when workspace.owner_count > 1 then 'shared_owner'
            when workspace.member_count > 1 then 'transfer_required'
            else 'deletion_required'
          end,
          'eligibleSuccessors', workspace.eligible_successors
        ) order by workspace.name, workspace.id
      )
      from (
        select
          w.id,
          w.name,
          (select count(*) from public.workspace_members as member
            where member.workspace_id = w.id) as member_count,
          (select count(*) from public.workspace_members as owner_member
            where owner_member.workspace_id = w.id
              and owner_member.role = 'owner') as owner_count,
          (select count(*) from public.projects as project
            where project.workspace_id = w.id) as project_count,
          (select count(*)
            from public.tasks as task
            join public.projects as project on project.id = task.project_id
            where project.workspace_id = w.id) as task_count,
          coalesce((
            select jsonb_agg(
              jsonb_build_object(
                'id', profile.id,
                'displayName', profile.display_name,
                'role', successor.role
              ) order by profile.display_name, profile.id
            )
            from public.workspace_members as successor
            join public.profiles as profile on profile.id = successor.user_id
            where successor.workspace_id = w.id
              and successor.user_id <> p_user_id
          ), '[]'::jsonb) as eligible_successors
        from public.workspace_members as membership
        join public.workspaces as w on w.id = membership.workspace_id
        where membership.user_id = p_user_id
          and membership.role = 'owner'
      ) as workspace
    ), '[]'::jsonb)
  )
$$;

create function public.prepare_account_deletion(
  p_user_id uuid,
  p_transfers jsonb default '{}'::jsonb,
  p_delete_workspace_ids uuid[] default '{}'::uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  owned_workspace record;
  selected_workspace_id uuid;
  successor_id uuid;
  successor_text text;
  deleted_workspace_count integer := 0;
  transferred_workspace_count integer := 0;
begin
  if jsonb_typeof(p_transfers) <> 'object' then
    raise exception 'Workspace transfers must be a JSON object'
      using errcode = '22023';
  end if;

  if pg_catalog.cardinality(p_delete_workspace_ids) is distinct from (
    select count(distinct workspace_id)
    from pg_catalog.unnest(p_delete_workspace_ids) as workspace_id
  ) then
    raise exception 'Workspace deletion selections must be unique'
      using errcode = '22023';
  end if;

  perform 1 from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'Account profile was not found' using errcode = 'P0002';
  end if;

  -- Reject deletion selections that are not personal workspaces owned solely
  -- by the account. This prevents the trusted RPC from becoming a broad delete.
  foreach selected_workspace_id in array p_delete_workspace_ids loop
    if not exists (
      select 1
      from public.workspace_members as membership
      where membership.workspace_id = selected_workspace_id
        and membership.user_id = p_user_id
        and membership.role = 'owner'
        and (
          select count(*)
          from public.workspace_members as member
          where member.workspace_id = selected_workspace_id
        ) = 1
    ) then
      raise exception 'Workspace % cannot be deleted by this account-deletion request',
        selected_workspace_id using errcode = '42501';
    end if;
  end loop;

  for owned_workspace in
    select
      workspace.id,
      workspace.name,
      (select count(*) from public.workspace_members as member
        where member.workspace_id = workspace.id) as member_count
    from public.workspace_members as membership
    join public.workspaces as workspace on workspace.id = membership.workspace_id
    where membership.user_id = p_user_id
      and membership.role = 'owner'
      and not exists (
        select 1
        from public.workspace_members as other_owner
        where other_owner.workspace_id = membership.workspace_id
          and other_owner.user_id <> p_user_id
          and other_owner.role = 'owner'
      )
    order by workspace.id
    for update of workspace
  loop
    if owned_workspace.member_count = 1 then
      if not owned_workspace.id = any(p_delete_workspace_ids) then
        raise exception 'Confirm deletion of personal workspace "%"',
          owned_workspace.name using errcode = 'P0001';
      end if;

      delete from public.workspaces where id = owned_workspace.id;
      deleted_workspace_count := deleted_workspace_count + 1;
      continue;
    end if;

    successor_text := p_transfers ->> owned_workspace.id::text;
    if successor_text is null then
      raise exception 'Choose a new owner for workspace "%"',
        owned_workspace.name using errcode = 'P0001';
    end if;

    begin
      successor_id := successor_text::uuid;
    exception when invalid_text_representation then
      raise exception 'The selected owner for workspace "%" is invalid',
        owned_workspace.name using errcode = '22023';
    end;

    if successor_id = p_user_id or not exists (
      select 1
      from public.workspace_members as successor
      where successor.workspace_id = owned_workspace.id
        and successor.user_id = successor_id
    ) then
      raise exception 'The new owner must already be a member of workspace "%"',
        owned_workspace.name using errcode = '42501';
    end if;

    update public.workspace_members
    set role = 'owner'
    where workspace_id = owned_workspace.id
      and user_id = successor_id;
    transferred_workspace_count := transferred_workspace_count + 1;
  end loop;

  return jsonb_build_object(
    'deletedWorkspaceCount', deleted_workspace_count,
    'transferredWorkspaceCount', transferred_workspace_count
  );
end;
$$;

revoke all on function public.account_deletion_impact(uuid)
from public, anon, authenticated;
revoke all on function public.prepare_account_deletion(uuid, jsonb, uuid[])
from public, anon, authenticated;

grant execute on function public.account_deletion_impact(uuid) to service_role;
grant execute on function public.prepare_account_deletion(uuid, jsonb, uuid[])
to service_role;

comment on function public.account_deletion_impact(uuid) is
  'Service-role-only preview of ownership decisions required before deleting an account.';
comment on function public.prepare_account_deletion(uuid, jsonb, uuid[]) is
  'Transfers sole ownership or deletes explicitly confirmed personal workspaces before Auth removal.';

commit;
