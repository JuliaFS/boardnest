begin;

-- System events are produced inside the same transaction as their source row.
-- This keeps notification creation atomic for GraphQL, SQL, and future workers.
create function private.task_notification_recipients(target_task_id uuid)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with task_context as (
    select task.id, task.project_id, task.created_by, project.workspace_id,
      project.visibility
    from public.tasks as task
    join public.projects as project on project.id = task.project_id
    where task.id = target_task_id
  ), candidates as (
    select member.user_id
    from public.project_members as member
    join task_context on task_context.project_id = member.project_id

    union

    select assignee.user_id
    from public.task_assignees as assignee
    where assignee.task_id = target_task_id

    union

    select task_context.created_by
    from task_context
    where task_context.created_by is not null

    union

    select comment.author_id
    from public.task_comments as comment
    where comment.task_id = target_task_id
      and comment.author_id is not null
  )
  select distinct candidate.user_id
  from candidates as candidate
  join task_context on true
  join public.workspace_members as workspace_member
    on workspace_member.workspace_id = task_context.workspace_id
   and workspace_member.user_id = candidate.user_id
  where task_context.visibility = 'workspace'
     or workspace_member.role in ('owner', 'admin')
     or exists (
       select 1
       from public.project_members as project_member
       where project_member.project_id = task_context.project_id
         and project_member.user_id = candidate.user_id
     );
$$;

revoke execute on function private.task_notification_recipients(uuid)
from public;

create function private.notify_workspace_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  member_label text;
  recipient record;
begin
  select coalesce(nullif(btrim(profile.display_name), ''), 'A member')
  into member_label
  from public.profiles as profile
  where profile.id = case when tg_op = 'INSERT' then new.user_id else old.user_id end;

  if tg_op = 'INSERT' then
    -- Workspace creation adds its owner automatically. That bootstrap action is
    -- not useful as a notification to the creator.
    if new.role = 'owner' and exists (
      select 1 from public.workspaces as workspace
      where workspace.id = new.workspace_id
        and workspace.created_by = new.user_id
    ) then
      return new;
    end if;

    perform public.create_notification_event(
      'workspace-member-added:' || new.workspace_id::text || ':'
        || new.user_id::text || ':' || extract(epoch from new.joined_at)::text,
      new.user_id,
      new.workspace_id,
      'workspace.member_added',
      'Added to workspace',
      'You are now a ' || replace(new.role, '_', ' ') || ' in this workspace.',
      actor_id,
      null,
      null,
      null,
      jsonb_build_object(
        'memberId', new.user_id,
        'role', new.role,
        'source', 'workspace_members'
      )
    );
    return new;
  end if;

  -- The removed account immediately loses workspace access, so the durable
  -- audit-style notification goes to the remaining owners and admins.
  for recipient in
    select member.user_id
    from public.workspace_members as member
    where member.workspace_id = old.workspace_id
      and member.user_id <> old.user_id
      and member.role in ('owner', 'admin')
  loop
    perform public.create_notification_event(
      'workspace-member-removed:' || old.workspace_id::text || ':'
        || old.user_id::text || ':' || extract(epoch from old.joined_at)::text,
      recipient.user_id,
      old.workspace_id,
      'workspace.member_removed',
      'Workspace member removed',
      member_label || ' is no longer a member of this workspace.',
      actor_id,
      null,
      null,
      null,
      jsonb_build_object(
        'memberId', old.user_id,
        'previousRole', old.role,
        'source', 'workspace_members'
      )
    );
  end loop;
  return old;
end;
$$;

revoke execute on function private.notify_workspace_membership_change()
from public;

create trigger workspace_members_notify_added
after insert on public.workspace_members
for each row execute function private.notify_workspace_membership_change();

create trigger workspace_members_notify_removed
before delete on public.workspace_members
for each row execute function private.notify_workspace_membership_change();

create function private.notify_project_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  project_name text;
begin
  select project.name into project_name
  from public.projects as project
  where project.id = case when tg_op = 'INSERT' then new.project_id else old.project_id end;

  if tg_op = 'INSERT' then
    -- Project creation adds its creator as project lead automatically.
    if new.role = 'project_lead' and exists (
      select 1 from public.projects as project
      where project.id = new.project_id
        and project.created_by = new.user_id
    ) then
      return new;
    end if;

    perform public.create_notification_event(
      'project-member-added:' || new.project_id::text || ':'
        || new.user_id::text || ':' || extract(epoch from new.joined_at)::text,
      new.user_id,
      new.workspace_id,
      'project.member_added',
      'Added to project',
      'You joined ' || project_name || ' as '
        || replace(new.role, '_', ' ') || '.',
      actor_id,
      new.project_id,
      null,
      null,
      jsonb_build_object(
        'memberId', new.user_id,
        'role', new.role,
        'source', 'project_members',
        'route', '/projects/' || new.project_id::text
      )
    );
    return new;
  end if;

  perform public.create_notification_event(
    'project-member-removed:' || old.project_id::text || ':'
      || old.user_id::text || ':' || extract(epoch from old.joined_at)::text,
    old.user_id,
    old.workspace_id,
    'project.member_removed',
    'Removed from project',
    'You no longer have explicit membership in ' || project_name || '.',
    actor_id,
    old.project_id,
    null,
    null,
    jsonb_build_object(
      'memberId', old.user_id,
      'previousRole', old.role,
      'source', 'project_members'
    )
  );
  return old;
end;
$$;

revoke execute on function private.notify_project_membership_change()
from public;

create trigger project_members_notify_added
after insert on public.project_members
for each row execute function private.notify_project_membership_change();

create trigger project_members_notify_removed
before delete on public.project_members
for each row execute function private.notify_project_membership_change();

create function private.notify_task_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := coalesce((select auth.uid()), new.created_by);
  event_timestamp timestamptz := case
    when tg_op = 'INSERT' then new.created_at
    else new.updated_at
  end;
  new_status_name text;
  old_status_name text;
  project_workspace_id uuid;
  recipient record;
begin
  select project.workspace_id into project_workspace_id
  from public.projects as project
  where project.id = new.project_id;

  if tg_op = 'INSERT' then
    for recipient in
      select audience.user_id
      from private.task_notification_recipients(new.id) as audience
      where audience.user_id is distinct from actor_id
    loop
      perform public.create_notification_event(
        'task-created:' || new.id::text,
        recipient.user_id,
        project_workspace_id,
        'task.created',
        'Task created',
        new.title || ' was created.',
        actor_id,
        new.project_id,
        new.id,
        null,
        jsonb_build_object(
          'source', 'tasks',
          'route', '/projects/' || new.project_id::text || '/tasks/' || new.id::text
        )
      );
    end loop;
    return new;
  end if;

  if new.status_id is distinct from old.status_id then
    select status.name into new_status_name
    from public.task_statuses as status where status.id = new.status_id;
    select status.name into old_status_name
    from public.task_statuses as status where status.id = old.status_id;

    for recipient in
      select audience.user_id
      from private.task_notification_recipients(new.id) as audience
      where audience.user_id is distinct from actor_id
    loop
      perform public.create_notification_event(
        'task-status-changed:' || new.id::text || ':'
          || extract(epoch from event_timestamp)::text,
        recipient.user_id,
        project_workspace_id,
        'task.status_changed',
        'Task status changed',
        new.title || ' moved from ' || old_status_name || ' to '
          || new_status_name || '.',
        actor_id,
        new.project_id,
        new.id,
        null,
        jsonb_build_object(
          'fromStatusId', old.status_id,
          'toStatusId', new.status_id,
          'source', 'tasks',
          'route', '/projects/' || new.project_id::text || '/tasks/' || new.id::text
        )
      );
    end loop;
  end if;

  if (new.title, new.description, new.priority, new.due_at, new.archived_at)
    is distinct from
    (old.title, old.description, old.priority, old.due_at, old.archived_at)
  then
    for recipient in
      select audience.user_id
      from private.task_notification_recipients(new.id) as audience
      where audience.user_id is distinct from actor_id
    loop
      perform public.create_notification_event(
        'task-updated:' || new.id::text || ':'
          || extract(epoch from event_timestamp)::text,
        recipient.user_id,
        project_workspace_id,
        'task.updated',
        'Task updated',
        new.title || ' was updated.',
        actor_id,
        new.project_id,
        new.id,
        null,
        jsonb_build_object(
          'source', 'tasks',
          'route', '/projects/' || new.project_id::text || '/tasks/' || new.id::text
        )
      );
    end loop;
  end if;

  return new;
end;
$$;

revoke execute on function private.notify_task_change() from public;

create trigger tasks_notify_created
after insert on public.tasks
for each row execute function private.notify_task_change();

create trigger tasks_notify_updated
after update on public.tasks
for each row execute function private.notify_task_change();

create function private.notify_task_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_context record;
begin
  select task.title, task.project_id, project.workspace_id
  into task_context
  from public.tasks as task
  join public.projects as project on project.id = task.project_id
  where task.id = new.task_id;

  perform public.create_notification_event(
    'task-assigned:' || new.task_id::text || ':' || new.user_id::text || ':'
      || extract(epoch from new.assigned_at)::text,
    new.user_id,
    task_context.workspace_id,
    'task.assigned',
    'Task assigned',
    'You were assigned to ' || task_context.title || '.',
    new.assigned_by,
    task_context.project_id,
    new.task_id,
    null,
    jsonb_build_object(
      'assigneeId', new.user_id,
      'source', 'task_assignees',
      'route', '/projects/' || task_context.project_id::text
        || '/tasks/' || new.task_id::text
    )
  );
  return new;
end;
$$;

revoke execute on function private.notify_task_assignment() from public;

create trigger task_assignees_notify_added
after insert on public.task_assignees
for each row execute function private.notify_task_assignment();

create function private.notify_comment_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  task_context record;
  recipient record;
begin
  select task.title, task.project_id, project.workspace_id
  into task_context
  from public.tasks as task
  join public.projects as project on project.id = task.project_id
  where task.id = new.task_id;

  for recipient in
    select audience.user_id
    from private.task_notification_recipients(new.task_id) as audience
    where audience.user_id is distinct from new.author_id
  loop
    perform public.create_notification_event(
      'comment-created:' || new.id::text,
      recipient.user_id,
      task_context.workspace_id,
      'comment.created',
      'New task comment',
      'A new comment was added to ' || task_context.title || '.',
      new.author_id,
      task_context.project_id,
      new.task_id,
      null,
      jsonb_build_object(
        'commentId', new.id,
        'source', 'task_comments',
        'route', '/projects/' || task_context.project_id::text
          || '/tasks/' || new.task_id::text
      )
    );
  end loop;
  return new;
end;
$$;

revoke execute on function private.notify_comment_created() from public;

create trigger task_comments_notify_created
after insert on public.task_comments
for each row execute function private.notify_comment_created();

-- The reminder scheduler predates event-specific preferences. These filters
-- preserve its atomic occurrence model while applying the canonical channel
-- resolver before either durable row is created.
create function private.filter_reminder_in_app_channel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  channels record;
begin
  if new.reminder_id is null or new.type <> 'task.reminder' then
    return new;
  end if;

  select * into channels
  from private.notification_event_channels(
    new.user_id,
    new.workspace_id,
    'task.reminder'
  );

  if not found or not channels.in_app_enabled then
    return null;
  end if;
  return new;
end;
$$;

revoke execute on function private.filter_reminder_in_app_channel()
from public;

create trigger notifications_00_filter_reminder_channel
before insert on public.notifications
for each row execute function private.filter_reminder_in_app_channel();

create function private.filter_reminder_email_channel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  channels record;
begin
  if new.reminder_id is null then
    return new;
  end if;

  select * into channels
  from private.notification_event_channels(
    new.user_id,
    new.workspace_id,
    'task.reminder'
  );

  if not found or not channels.email_enabled then
    return null;
  end if;
  return new;
end;
$$;

revoke execute on function private.filter_reminder_email_channel()
from public;

-- PostgreSQL runs same-kind triggers alphabetically. The 00 prefix ensures an
-- opted-out reminder is discarded before monthly quota validation.
create trigger notification_deliveries_00_filter_reminder_channel
before insert on public.notification_deliveries
for each row execute function private.filter_reminder_email_channel();

comment on function private.task_notification_recipients(uuid) is
  'Returns current project and task participants who still have project access.';
comment on function private.notify_workspace_membership_change() is
  'Produces canonical workspace membership notification events atomically.';
comment on function private.notify_project_membership_change() is
  'Produces canonical project membership notification events atomically.';
comment on function private.notify_task_change() is
  'Produces task creation, detail update, and status change notification events.';
comment on function private.notify_task_assignment() is
  'Produces a direct notification when a user is assigned to a task.';
comment on function private.notify_comment_created() is
  'Notifies current task participants when a comment is created.';
comment on function private.filter_reminder_in_app_channel() is
  'Applies canonical event preferences to reminder in-app occurrences.';
comment on function private.filter_reminder_email_channel() is
  'Applies canonical event preferences and plan gates to reminder email occurrences.';

commit;
