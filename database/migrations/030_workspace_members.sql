begin;

-- Workspace membership is the primary role-based authorization source.
create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'member',
  joined_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  primary key (workspace_id, user_id),
  constraint workspace_members_role_check
    check (role in ('owner', 'admin', 'member', 'viewer'))
);

alter table public.workspace_members enable row level security;

create index workspace_members_user_id_idx
  on public.workspace_members (user_id, workspace_id);
create index workspace_members_workspace_role_idx
  on public.workspace_members (workspace_id, role);

comment on table public.workspace_members is
  'Associates users with a workspace and assigns the tenant-level role.';

create trigger workspace_members_set_updated_at
before update on public.workspace_members
for each row execute function private.set_updated_at();

create function private.add_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$;

revoke execute on function private.add_workspace_owner() from public;

create trigger workspaces_add_owner
after insert on public.workspaces
for each row execute function private.add_workspace_owner();

create function private.protect_workspace_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_role text;
  owner_count integer;
begin
  if tg_op = 'UPDATE'
    and (new.workspace_id, new.user_id) is distinct from (old.workspace_id, old.user_id)
  then
    raise exception 'Workspace membership identity cannot be changed'
      using errcode = '23514';
  end if;

  if (select auth.uid()) is not null then
    select wm.role
    into actor_role
    from public.workspace_members as wm
    where wm.workspace_id = old.workspace_id
      and wm.user_id = (select auth.uid());

    if actor_role = 'admin'
      and (
        old.role = 'owner'
        or (tg_op = 'UPDATE' and new.role = 'owner')
      )
    then
      raise exception 'Admins cannot add, remove, or demote workspace owners'
        using errcode = '42501';
    end if;
  end if;

  if old.role <> 'owner'
    or (tg_op = 'UPDATE' and new.role = 'owner')
  then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  -- The parent is already absent during an ON DELETE CASCADE operation.
  perform 1
  from public.workspaces
  where id = old.workspace_id
  for update;

  if not found then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  select count(*)
  into owner_count
  from public.workspace_members
  where workspace_id = old.workspace_id
    and role = 'owner';

  if owner_count <= 1 then
    raise exception 'A workspace must retain at least one owner'
      using errcode = '23514';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke execute on function private.protect_workspace_owner() from public;

create trigger workspace_members_protect_owner
before update or delete on public.workspace_members
for each row execute function private.protect_workspace_owner();

commit;
