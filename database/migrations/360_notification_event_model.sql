begin;

-- Event metadata is data-driven so new notification types do not require
-- additional preference columns or hardcoded plan checks.
create table public.notification_event_types (
  code text primary key,
  display_name text not null,
  description text not null,
  category text not null,
  default_in_app_enabled boolean not null default true,
  default_email_enabled boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  constraint notification_event_types_code_check
    check (code ~ '^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$'),
  constraint notification_event_types_display_name_check
    check (char_length(btrim(display_name)) between 1 and 100),
  constraint notification_event_types_description_check
    check (char_length(btrim(description)) between 1 and 1000),
  constraint notification_event_types_category_check
    check (category in ('workspace', 'project', 'task', 'comment', 'reminder', 'custom'))
);

alter table public.notification_event_types enable row level security;

create trigger notification_event_types_set_updated_at
before update on public.notification_event_types
for each row execute function private.set_updated_at();

insert into public.notification_event_types (
  code,
  display_name,
  description,
  category,
  default_in_app_enabled,
  default_email_enabled
)
values
  ('workspace.member_added', 'Workspace member added', 'A member joined a workspace.', 'workspace', true, true),
  ('workspace.member_removed', 'Workspace member removed', 'A member left or was removed from a workspace.', 'workspace', true, true),
  ('project.member_added', 'Project member added', 'A member was added to a project.', 'project', true, true),
  ('project.member_removed', 'Project member removed', 'A member was removed from a project.', 'project', true, true),
  ('task.created', 'Task created', 'A task was created in a visible project.', 'task', true, false),
  ('task.assigned', 'Task assigned', 'A task was assigned to the recipient.', 'task', true, true),
  ('task.updated', 'Task updated', 'Task details were changed.', 'task', true, false),
  ('task.status_changed', 'Task status changed', 'A task moved to another workflow status.', 'task', true, false),
  ('comment.created', 'Comment created', 'A new task comment was added.', 'comment', true, true),
  ('task.reminder', 'Task reminder', 'A scheduled task reminder became due.', 'reminder', true, true),
  ('custom.notification', 'Custom notification', 'A user-defined notification became due.', 'custom', true, true);

-- Entitlements are workspace-plan scoped. User choices can narrow these
-- capabilities but cannot enable a channel that the effective plan disallows.
create table public.plan_notification_events (
  plan_code text not null references public.subscription_plans (code) on update cascade on delete cascade,
  event_type text not null references public.notification_event_types (code) on update cascade on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  primary key (plan_code, event_type)
);

alter table public.plan_notification_events enable row level security;

create trigger plan_notification_events_set_updated_at
before update on public.plan_notification_events
for each row execute function private.set_updated_at();

insert into public.plan_notification_events (
  plan_code,
  event_type,
  in_app_enabled,
  email_enabled
)
select
  plan.code,
  event.code,
  true,
  case
    when plan.code = 'guest' then false
    when plan.code = 'free' then event.default_email_enabled
    else true
  end
from public.subscription_plans as plan
cross join public.notification_event_types as event;

-- Rows are optional overrides. Missing rows inherit the event catalog defaults.
create table public.notification_event_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  event_type text not null references public.notification_event_types (code) on update cascade on delete cascade,
  in_app_enabled boolean not null,
  email_enabled boolean not null,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  primary key (user_id, event_type)
);

alter table public.notification_event_preferences enable row level security;

create index notification_event_preferences_event_idx
  on public.notification_event_preferences (event_type, user_id);

create trigger notification_event_preferences_set_updated_at
before update on public.notification_event_preferences
for each row execute function private.set_updated_at();

-- Stable event keys prevent duplicate in-app rows when a producer retries.
alter table public.notifications
  add column actor_id uuid references public.profiles (id) on delete set null,
  add column event_key text;

alter table public.notifications
  add constraint notifications_event_key_check
  check (
    event_key is null
    or char_length(btrim(event_key)) between 16 and 220
  );

create unique index notifications_user_event_key_unique_idx
  on public.notifications (user_id, event_key)
  where event_key is not null;

create function private.notification_event_channels(
  target_user_id uuid,
  target_workspace_id uuid,
  target_event_type text
)
returns table (in_app_enabled boolean, email_enabled boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    global_preference.in_app_enabled
      and entitlement.in_app_enabled
      and legacy.event_enabled
      and coalesce(event_preference.in_app_enabled, event.default_in_app_enabled),
    global_preference.email_enabled
      and plan.email_enabled
      and entitlement.email_enabled
      and legacy.event_enabled
      and coalesce(event_preference.email_enabled, event.default_email_enabled)
  from public.notification_event_types as event
  join public.notification_preferences as global_preference
    on global_preference.user_id = target_user_id
  join public.subscription_plans as plan
    on plan.code = private.effective_workspace_plan(target_workspace_id)
  join public.plan_notification_events as entitlement
    on entitlement.plan_code = plan.code
   and entitlement.event_type = event.code
  left join public.notification_event_preferences as event_preference
    on event_preference.user_id = target_user_id
   and event_preference.event_type = event.code
  cross join lateral (
    select case target_event_type
      when 'task.created' then global_preference.task_created_enabled
      when 'task.assigned' then global_preference.task_assigned_enabled
      when 'task.reminder' then global_preference.reminder_enabled
      else true
    end as event_enabled
  ) as legacy
  where event.code = target_event_type
    and event.is_active
$$;

revoke execute on function private.notification_event_channels(uuid, uuid, text)
from public;

create function private.queue_notification_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  channels record;
  delivery_key text;
begin
  -- The existing reminder scheduler creates its in-app and outbox rows in the
  -- same transaction. Re-queuing here would run quota checks twice before the
  -- delivery idempotency conflict is resolved.
  if new.reminder_id is not null then
    return new;
  end if;

  select * into channels
  from private.notification_event_channels(new.user_id, new.workspace_id, new.type);

  if not found or not channels.email_enabled then
    return new;
  end if;

  delivery_key := case
    when new.event_key is not null then
      'notification-event:' || encode(
        extensions.digest(new.user_id::text || ':' || new.event_key, 'sha256'),
        'hex'
      )
    else
      'notification-event:' || encode(
        extensions.digest(new.user_id::text || ':' || new.id::text, 'sha256'),
        'hex'
      )
  end;

  begin
    insert into public.notification_deliveries (
      reminder_id,
      notification_id,
      workspace_id,
      user_id,
      scheduled_for,
      next_attempt_at,
      idempotency_key,
      payload
    )
    values (
      new.reminder_id,
      new.id,
      new.workspace_id,
      new.user_id,
      coalesce(new.scheduled_for, new.created_at),
      coalesce(new.scheduled_for, new.created_at),
      delivery_key,
      new.payload || jsonb_build_object(
        'notificationId', new.id,
        'eventType', new.type,
        'title', new.title,
        'body', new.body,
        'actorId', new.actor_id,
        'projectId', new.project_id,
        'taskId', new.task_id
      )
    )
    on conflict (idempotency_key) do nothing;
  exception
    when sqlstate 'P0001' then
      -- Email quota or plan changes must never roll back an in-app event.
      null;
  end;

  return new;
end;
$$;

revoke execute on function private.queue_notification_email() from public;

create trigger notifications_queue_email
after insert on public.notifications
for each row execute function private.queue_notification_email();

-- Trusted producers use one entry point for validation, channel preferences,
-- idempotent in-app creation, and email-only delivery.
create function public.create_notification_event(
  p_event_key text,
  p_user_id uuid,
  p_workspace_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_actor_id uuid default null,
  p_project_id uuid default null,
  p_task_id uuid default null,
  p_scheduled_for timestamptz default null,
  p_payload jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  channels record;
  created_notification_id uuid;
  delivery_key text;
begin
  if p_event_key is null
    or char_length(btrim(p_event_key)) not between 16 and 220 then
    raise exception 'Notification event key must contain between 16 and 220 characters'
      using errcode = '22023';
  end if;

  if p_title is null or char_length(btrim(p_title)) not between 1 and 160 then
    raise exception 'Notification title must contain between 1 and 160 characters'
      using errcode = '22023';
  end if;

  if p_body is not null and char_length(p_body) > 2000 then
    raise exception 'Notification body cannot exceed 2000 characters'
      using errcode = '22023';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Notification payload must be a JSON object'
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.notification_event_types as event
    where event.code = p_type and event.is_active
  ) then
    raise exception 'Unknown or inactive notification event type: %', p_type
      using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.workspace_members as member
    where member.workspace_id = p_workspace_id
      and member.user_id = p_user_id
  ) then
    raise exception 'Notification recipient must be a workspace member'
      using errcode = '23514';
  end if;

  if p_actor_id is not null and not exists (
    select 1 from public.workspace_members as actor
    where actor.workspace_id = p_workspace_id
      and actor.user_id = p_actor_id
  ) then
    raise exception 'Notification actor must be a workspace member'
      using errcode = '23514';
  end if;

  if p_project_id is not null and not exists (
    select 1 from public.projects as project
    where project.id = p_project_id
      and project.workspace_id = p_workspace_id
  ) then
    raise exception 'Notification project does not belong to the workspace'
      using errcode = '23514';
  end if;

  if p_task_id is not null and not exists (
    select 1
    from public.tasks as task
    join public.projects as project on project.id = task.project_id
    where task.id = p_task_id
      and project.workspace_id = p_workspace_id
      and (p_project_id is null or project.id = p_project_id)
  ) then
    raise exception 'Notification task does not belong to its project and workspace'
      using errcode = '23514';
  end if;

  select * into channels
  from private.notification_event_channels(p_user_id, p_workspace_id, p_type);

  if not found or (not channels.in_app_enabled and not channels.email_enabled) then
    return null;
  end if;

  if channels.in_app_enabled then
    insert into public.notifications (
      user_id,
      workspace_id,
      project_id,
      task_id,
      actor_id,
      event_key,
      scheduled_for,
      type,
      title,
      body,
      payload
    )
    values (
      p_user_id,
      p_workspace_id,
      p_project_id,
      p_task_id,
      p_actor_id,
      btrim(p_event_key),
      p_scheduled_for,
      p_type,
      p_title,
      p_body,
      p_payload
    )
    on conflict (user_id, event_key) where event_key is not null
    do nothing
    returning id into created_notification_id;

    if created_notification_id is null then
      select notification.id into created_notification_id
      from public.notifications as notification
      where notification.user_id = p_user_id
        and notification.event_key = btrim(p_event_key);
    end if;
  elsif channels.email_enabled then
    delivery_key := 'notification-event:' || encode(
      extensions.digest(p_user_id::text || ':' || btrim(p_event_key), 'sha256'),
      'hex'
    );

    begin
      insert into public.notification_deliveries (
        workspace_id,
        user_id,
        scheduled_for,
        next_attempt_at,
        idempotency_key,
        payload
      )
      values (
        p_workspace_id,
        p_user_id,
        coalesce(p_scheduled_for, statement_timestamp()),
        coalesce(p_scheduled_for, statement_timestamp()),
        delivery_key,
        p_payload || jsonb_build_object(
          'eventType', p_type,
          'title', p_title,
          'body', p_body,
          'actorId', p_actor_id,
          'projectId', p_project_id,
          'taskId', p_task_id
        )
      )
      on conflict (idempotency_key) do nothing;
    exception
      when sqlstate 'P0001' then null;
    end;
  end if;

  return created_notification_id;
end;
$$;

revoke all on function public.create_notification_event(
  text, uuid, uuid, text, text, text, uuid, uuid, uuid, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.create_notification_event(
  text, uuid, uuid, text, text, text, uuid, uuid, uuid, timestamptz, jsonb
) to service_role;

create policy "notification_event_types_select_authenticated"
on public.notification_event_types for select to authenticated
using (is_active);

create policy "plan_notification_events_select_authenticated"
on public.plan_notification_events for select to authenticated
using (true);

create policy "notification_event_preferences_select_self"
on public.notification_event_preferences for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "notification_event_preferences_insert_self"
on public.notification_event_preferences for insert to authenticated
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "notification_event_preferences_update_self"
on public.notification_event_preferences for update to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()))
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "notification_event_preferences_delete_self"
on public.notification_event_preferences for delete to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

revoke all on table
  public.notification_event_types,
  public.plan_notification_events,
  public.notification_event_preferences
from anon, authenticated;

grant select on table
  public.notification_event_types,
  public.plan_notification_events,
  public.notification_event_preferences
to authenticated;

grant insert (user_id, event_type, in_app_enabled, email_enabled)
on public.notification_event_preferences to authenticated;
-- PostgREST upsert includes the composite conflict key in its update list.
-- RLS still prevents moving a row to another user.
grant update (user_id, event_type, in_app_enabled, email_enabled)
on public.notification_event_preferences to authenticated;
grant delete on public.notification_event_preferences to authenticated;

grant select, insert, update, delete on table
  public.notification_event_types,
  public.plan_notification_events,
  public.notification_event_preferences
to service_role;

comment on table public.notification_event_types is
  'Canonical notification event catalog with channel defaults.';
comment on table public.plan_notification_events is
  'Per-plan notification event and channel entitlements.';
comment on table public.notification_event_preferences is
  'Optional per-user event channel overrides; missing rows inherit catalog defaults.';
comment on column public.notification_deliveries.idempotency_key is
  'Stable occurrence key preventing a notification email from being queued twice.';
comment on function public.create_notification_event(
  text, uuid, uuid, text, text, text, uuid, uuid, uuid, timestamptz, jsonb
) is
  'Creates one idempotent notification event and queues an entitled email delivery for trusted producers.';

commit;
