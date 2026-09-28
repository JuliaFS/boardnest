begin;

-- Anonymous Supabase users use the authenticated database role. These triggers
-- enforce demo quotas independently of the UI and serialize concurrent inserts
-- per guest so parallel requests cannot exceed a limit.
create function private.is_anonymous_user()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(((select auth.jwt()) ->> 'is_anonymous')::boolean, false)
$$;

create function private.enforce_anonymous_insert_quota()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_count integer;
begin
  if not private.is_anonymous_user() then
    return new;
  end if;

  if actor_id is null then
    raise exception 'Guest session is missing a user identity'
      using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(actor_id::text, 0));

  case tg_table_name
    when 'workspaces' then
      if new.created_by is distinct from actor_id then
        raise exception 'Guest resources must belong to the current guest'
          using errcode = '42501';
      end if;
      select count(*) into current_count
      from public.workspaces
      where created_by = actor_id;
      if current_count >= 1 then
        raise exception 'Guest limit reached: 1 workspace.'
          using errcode = 'P0001';
      end if;

    when 'projects' then
      if new.created_by is distinct from actor_id then
        raise exception 'Guest resources must belong to the current guest'
          using errcode = '42501';
      end if;
      select count(*) into current_count
      from public.projects
      where created_by = actor_id;
      if current_count >= 1 then
        raise exception 'Guest limit reached: 1 project.'
          using errcode = 'P0001';
      end if;

    when 'tasks' then
      if new.created_by is distinct from actor_id then
        raise exception 'Guest resources must belong to the current guest'
          using errcode = '42501';
      end if;
      select count(*) into current_count
      from public.tasks
      where created_by = actor_id;
      if current_count >= 20 then
        raise exception 'Guest limit reached: 20 tasks.'
          using errcode = 'P0001';
      end if;

    when 'invitations' then
      if new.invited_by is distinct from actor_id then
        raise exception 'Guest resources must belong to the current guest'
          using errcode = '42501';
      end if;
      select count(*) into current_count
      from public.invitations
      where invited_by = actor_id;
      if current_count >= 1 then
        raise exception 'Guest limit reached: 1 invitation.'
          using errcode = 'P0001';
      end if;

    when 'task_comments' then
      if new.author_id is distinct from actor_id then
        raise exception 'Guest resources must belong to the current guest'
          using errcode = '42501';
      end if;
      select count(*) into current_count
      from public.task_comments
      where author_id = actor_id;
      if current_count >= 10 then
        raise exception 'Guest limit reached: 10 comments.'
          using errcode = 'P0001';
      end if;

    else
      raise exception 'Unsupported guest quota target: %', tg_table_name;
  end case;

  return new;
end;
$$;

revoke execute on function private.is_anonymous_user() from public;
revoke execute on function private.enforce_anonymous_insert_quota() from public;
grant execute on function private.is_anonymous_user() to authenticated;

create trigger workspaces_enforce_anonymous_quota
before insert on public.workspaces
for each row execute function private.enforce_anonymous_insert_quota();

create trigger projects_enforce_anonymous_quota
before insert on public.projects
for each row execute function private.enforce_anonymous_insert_quota();

create trigger tasks_enforce_anonymous_quota
before insert on public.tasks
for each row execute function private.enforce_anonymous_insert_quota();

create trigger invitations_enforce_anonymous_quota
before insert on public.invitations
for each row execute function private.enforce_anonymous_insert_quota();

create trigger task_comments_enforce_anonymous_quota
before insert on public.task_comments
for each row execute function private.enforce_anonymous_insert_quota();

comment on function private.enforce_anonymous_insert_quota() is
  'Enforces concurrency-safe demo limits for anonymous Supabase Auth users.';

commit;
