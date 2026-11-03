begin;

create table public.user_devices (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null,
  push_token text not null,
  device_name text,
  enabled boolean not null default true,
  last_seen_at timestamptz not null default statement_timestamp(),
  created_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,

  constraint user_devices_platform_check check (platform in ('android', 'ios')),
  constraint user_devices_push_token_check
    check (push_token ~ '^(ExponentPushToken|ExpoPushToken)\\[[A-Za-z0-9_-]+\\]$'),
  constraint user_devices_name_check
    check (device_name is null or char_length(btrim(device_name)) between 1 and 120),
  constraint user_devices_revoked_check
    check ((enabled and revoked_at is null) or not enabled)
);

alter table public.user_devices enable row level security;

create unique index user_devices_push_token_unique_idx
  on public.user_devices (push_token);
create index user_devices_user_active_idx
  on public.user_devices (user_id, last_seen_at desc)
  where enabled and revoked_at is null;

create policy "user_devices_select_self"
on public.user_devices for select to authenticated
using (user_id = (select auth.uid()));

revoke all on table public.user_devices from anon, authenticated;
grant select on table public.user_devices to authenticated;
grant select, insert, update, delete on table public.user_devices to service_role;

alter table public.notification_preferences
  add column push_enabled boolean not null default true;
alter table public.notification_event_types
  add column default_push_enabled boolean not null default true;
alter table public.notification_event_preferences
  add column push_enabled boolean not null default true;
alter table public.plan_notification_events
  add column push_enabled boolean not null default true;

update public.plan_notification_events
set push_enabled = plan_code <> 'guest';

alter table public.notification_deliveries
  add column device_id uuid references public.user_devices (id) on delete set null;

alter table public.notification_deliveries
  drop constraint notification_deliveries_channel_check,
  add constraint notification_deliveries_channel_check
    check (channel in ('email', 'push')),
  drop constraint notification_deliveries_status_check,
  add constraint notification_deliveries_status_check
    check (status in ('pending', 'processing', 'sent', 'delivered', 'failed', 'canceled'));

create index notification_deliveries_push_receipt_idx
  on public.notification_deliveries (next_attempt_at, id)
  where channel = 'push' and status = 'sent';
create index notification_deliveries_device_idx
  on public.notification_deliveries (device_id, status)
  where channel = 'push';

alter table public.notification_delivery_attempts
  drop constraint notification_delivery_attempts_provider_check,
  add constraint notification_delivery_attempts_provider_check
    check (provider in ('smtp', 'expo'));

create or replace function private.enforce_email_delivery_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  effective_plan text;
  plan_email_enabled boolean;
  plan_monthly_limit integer;
  queued_this_month integer;
  month_start timestamptz;
begin
  if not exists (
    select 1 from public.workspace_members as member
    where member.workspace_id = new.workspace_id and member.user_id = new.user_id
  ) then
    raise exception 'Notification recipient must be a workspace member' using errcode = '23514';
  end if;

  if new.channel = 'push' then
    if new.device_id is null or not exists (
      select 1 from public.user_devices as device
      where device.id = new.device_id
        and device.user_id = new.user_id
        and device.enabled
        and device.revoked_at is null
    ) then
      raise exception 'Push delivery requires an active recipient device' using errcode = '23514';
    end if;
    return new;
  end if;

  effective_plan := private.effective_workspace_plan(new.workspace_id);
  select plan.email_enabled, plan.monthly_email_limit
  into plan_email_enabled, plan_monthly_limit
  from public.subscription_plans as plan where plan.code = effective_plan;
  if not found or not plan_email_enabled then
    raise exception 'The % plan does not include email notifications', effective_plan using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text, 3));
  month_start := date_trunc('month', statement_timestamp() at time zone 'UTC') at time zone 'UTC';
  select count(*) into queued_this_month
  from public.notification_deliveries as delivery
  where delivery.workspace_id = new.workspace_id
    and delivery.channel = 'email'
    and delivery.status <> 'canceled'
    and delivery.created_at >= month_start;
  if queued_this_month >= plan_monthly_limit then
    raise exception 'Monthly email limit reached: % delivery/deliveries.', plan_monthly_limit using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create function private.notification_event_push_enabled(
  target_user_id uuid,
  target_workspace_id uuid,
  target_event_type text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select preference.push_enabled
      and entitlement.push_enabled
      and coalesce(event_preference.push_enabled, event.default_push_enabled)
    from public.notification_event_types as event
    join public.notification_preferences as preference on preference.user_id = target_user_id
    join public.plan_notification_events as entitlement
      on entitlement.plan_code = private.effective_workspace_plan(target_workspace_id)
     and entitlement.event_type = event.code
    left join public.notification_event_preferences as event_preference
      on event_preference.user_id = target_user_id
     and event_preference.event_type = event.code
    where event.code = target_event_type and event.is_active
  ), false)
$$;

revoke execute on function private.notification_event_push_enabled(uuid, uuid, text) from public;

create function private.queue_notification_push(
  target_notification_id uuid,
  target_event_key text,
  target_user_id uuid,
  target_workspace_id uuid,
  target_event_type text,
  target_title text,
  target_body text,
  target_actor_id uuid,
  target_project_id uuid,
  target_task_id uuid,
  target_scheduled_for timestamptz,
  target_payload jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_payload ? 'requestedChannels'
    and coalesce((target_payload #>> '{requestedChannels,push}')::boolean, false) = false
  then
    return;
  end if;
  if not private.notification_event_push_enabled(
    target_user_id, target_workspace_id, target_event_type
  ) then
    return;
  end if;

  insert into public.notification_deliveries (
    notification_id, workspace_id, user_id, device_id, channel, scheduled_for,
    next_attempt_at, idempotency_key, payload
  )
  select
    target_notification_id,
    target_workspace_id,
    target_user_id,
    device.id,
    'push',
    coalesce(target_scheduled_for, statement_timestamp()),
    coalesce(target_scheduled_for, statement_timestamp()),
    'push-event:' || encode(extensions.digest(
      target_user_id::text || ':' || device.id::text || ':' ||
      coalesce(target_event_key, target_notification_id::text), 'sha256'
    ), 'hex'),
    target_payload || jsonb_build_object(
      'notificationId', target_notification_id,
      'eventType', target_event_type,
      'title', target_title,
      'body', target_body,
      'actorId', target_actor_id,
      'workspaceId', target_workspace_id,
      'projectId', target_project_id,
      'taskId', target_task_id
    )
  from public.user_devices as device
  where device.user_id = target_user_id
    and device.enabled
    and device.revoked_at is null
  on conflict (idempotency_key) do nothing;
end;
$$;

revoke execute on function private.queue_notification_push(
  uuid, text, uuid, uuid, text, text, text, uuid, uuid, uuid, timestamptz, jsonb
) from public;

create function private.queue_inserted_notification_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.queue_notification_push(
    new.id, new.event_key, new.user_id, new.workspace_id, new.type, new.title,
    new.body, new.actor_id, new.project_id, new.task_id, new.scheduled_for, new.payload
  );
  return new;
end;
$$;

revoke execute on function private.queue_inserted_notification_push() from public;
create trigger notifications_queue_push
after insert on public.notifications
for each row execute function private.queue_inserted_notification_push();

alter function public.create_notification_event(
  text, uuid, uuid, text, text, text, uuid, uuid, uuid, timestamptz, jsonb
) rename to create_notification_event_without_push;

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
  notification_id uuid;
begin
  notification_id := public.create_notification_event_without_push(
    p_event_key, p_user_id, p_workspace_id, p_type, p_title, p_body,
    p_actor_id, p_project_id, p_task_id, p_scheduled_for, p_payload
  );

  -- An inserted in-app row already invokes notifications_queue_push. The
  -- explicit path below preserves push-only and email-plus-push preferences.
  if notification_id is null then
    perform private.queue_notification_push(
      null, p_event_key, p_user_id, p_workspace_id, p_type, p_title, p_body,
      p_actor_id, p_project_id, p_task_id, p_scheduled_for, p_payload
    );
  end if;
  return notification_id;
end;
$$;

revoke all on function public.create_notification_event(
  text, uuid, uuid, text, text, text, uuid, uuid, uuid, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function public.create_notification_event(
  text, uuid, uuid, text, text, text, uuid, uuid, uuid, timestamptz, jsonb
) to service_role;

create function public.register_push_device(
  p_platform text,
  p_push_token text,
  p_device_name text default null
)
returns public.user_devices
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  registered public.user_devices%rowtype;
begin
  if current_user_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if p_platform not in ('android', 'ios') then raise exception 'Unsupported device platform' using errcode = '22023'; end if;
  if p_push_token !~ '^(ExponentPushToken|ExpoPushToken)\\[[A-Za-z0-9_-]+\\]$' then
    raise exception 'Invalid Expo push token' using errcode = '22023';
  end if;

  insert into public.user_devices (user_id, platform, push_token, device_name)
  values (current_user_id, p_platform, p_push_token, nullif(btrim(p_device_name), ''))
  on conflict (push_token) do update
  set user_id = excluded.user_id,
      platform = excluded.platform,
      device_name = excluded.device_name,
      enabled = true,
      revoked_at = null,
      last_seen_at = statement_timestamp()
  returning * into registered;
  return registered;
end;
$$;

create function public.revoke_push_device(p_device_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.user_devices
  set enabled = false, revoked_at = statement_timestamp()
  where id = p_device_id and user_id = auth.uid();
  return found;
end;
$$;

revoke all on function public.register_push_device(text, text, text) from public, anon;
revoke all on function public.revoke_push_device(uuid) from public, anon;
grant execute on function public.register_push_device(text, text, text) to authenticated;
grant execute on function public.revoke_push_device(uuid) to authenticated;

create function public.claim_push_notification_deliveries(
  p_batch_size integer default 50,
  p_now timestamptz default statement_timestamp()
)
returns table (
  id uuid, lock_token uuid, device_id uuid, push_token text, payload jsonb,
  attempt_count integer, max_attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_batch_size not between 1 and 100 then raise exception 'Delivery batch size must be between 1 and 100' using errcode = '22023'; end if;

  update public.notification_deliveries as delivery
  set status = 'canceled', error_code = 'PUSH_NOT_ELIGIBLE',
      error_message = 'Push delivery is no longer permitted.', locked_at = null, lock_token = null
  where delivery.channel = 'push'
    and delivery.status in ('pending', 'failed')
    and delivery.next_attempt_at <= p_now
    and not exists (
      select 1 from public.user_devices as device
      where device.id = delivery.device_id and device.enabled and device.revoked_at is null
        and private.notification_event_push_enabled(
          delivery.user_id, delivery.workspace_id, delivery.payload ->> 'eventType'
        )
    );

  return query
  with candidates as (
    select delivery.id
    from public.notification_deliveries as delivery
    join public.user_devices as device on device.id = delivery.device_id
    where delivery.channel = 'push'
      and delivery.scheduled_for <= p_now and delivery.next_attempt_at <= p_now
      and delivery.attempt_count < delivery.max_attempts
      and device.enabled and device.revoked_at is null
      and private.notification_event_push_enabled(
        delivery.user_id, delivery.workspace_id, delivery.payload ->> 'eventType'
      )
      and (delivery.status in ('pending', 'failed') or
        (delivery.status = 'processing' and delivery.locked_at <= p_now - interval '5 minutes'))
    order by delivery.next_attempt_at, delivery.id
    for update of delivery skip locked limit p_batch_size
  ), claimed as (
    update public.notification_deliveries as delivery
    set status = 'processing', attempt_count = delivery.attempt_count + 1,
        locked_at = p_now, last_attempt_at = p_now,
        lock_token = extensions.gen_random_uuid(), error_code = null, error_message = null
    from candidates where delivery.id = candidates.id returning delivery.*
  )
  select claimed.id, claimed.lock_token, claimed.device_id, device.push_token,
         claimed.payload, claimed.attempt_count, claimed.max_attempts
  from claimed join public.user_devices as device on device.id = claimed.device_id
  order by claimed.next_attempt_at, claimed.id;
end;
$$;

create function public.record_push_notification_ticket(
  p_delivery_id uuid,
  p_lock_token uuid,
  p_ticket_id text,
  p_now timestamptz default statement_timestamp()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_deliveries
  set status = 'sent', provider_message_id = btrim(p_ticket_id),
      next_attempt_at = p_now + interval '15 minutes', locked_at = null, lock_token = null
  where id = p_delivery_id and channel = 'push' and status = 'processing' and lock_token = p_lock_token;
  return found;
end;
$$;

create function public.claim_push_notification_receipts(
  p_batch_size integer default 100,
  p_now timestamptz default statement_timestamp()
)
returns table (id uuid, lock_token uuid, ticket_id text, device_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with candidates as (
    select delivery.id from public.notification_deliveries as delivery
    where delivery.channel = 'push' and delivery.status = 'sent'
      and delivery.next_attempt_at <= p_now
      and (delivery.locked_at is null or delivery.locked_at <= p_now - interval '5 minutes')
    order by delivery.next_attempt_at, delivery.id
    for update skip locked limit greatest(1, least(p_batch_size, 1000))
  ), claimed as (
    update public.notification_deliveries as delivery
    set locked_at = p_now, lock_token = extensions.gen_random_uuid()
    from candidates where delivery.id = candidates.id returning delivery.*
  )
  select claimed.id, claimed.lock_token, claimed.provider_message_id, claimed.device_id from claimed;
end;
$$;

create function public.complete_push_notification_receipt(
  p_delivery_id uuid,
  p_lock_token uuid,
  p_now timestamptz default statement_timestamp()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare claimed public.notification_deliveries%rowtype;
begin
  update public.notification_deliveries as delivery
  set status = 'delivered', delivered_at = p_now, locked_at = null, lock_token = null,
      error_code = null, error_message = null
  where delivery.id = p_delivery_id and delivery.channel = 'push'
    and delivery.status = 'sent' and delivery.lock_token = p_lock_token
  returning delivery.* into claimed;
  if not found then return false; end if;
  insert into public.notification_delivery_attempts (
    delivery_id, attempt_number, provider, status, provider_message_id, started_at, finished_at
  ) values (claimed.id, claimed.attempt_count, 'expo', 'delivered', claimed.provider_message_id,
            claimed.last_attempt_at, p_now);
  return true;
end;
$$;

create function public.release_push_notification_receipt(
  p_delivery_id uuid,
  p_lock_token uuid,
  p_error_message text,
  p_now timestamptz default statement_timestamp()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_deliveries
  set locked_at = null,
      lock_token = null,
      next_attempt_at = p_now + interval '1 minute',
      error_code = 'EXPO_RECEIPT_UNAVAILABLE',
      error_message = left(p_error_message, 4000)
  where id = p_delivery_id and channel = 'push'
    and status = 'sent' and lock_token = p_lock_token;
  return found;
end;
$$;

create function public.fail_push_notification_delivery(
  p_delivery_id uuid,
  p_lock_token uuid,
  p_error_code text,
  p_error_message text,
  p_retryable boolean,
  p_revoke_device boolean default false,
  p_now timestamptz default statement_timestamp()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare claimed public.notification_deliveries%rowtype;
declare retry_at timestamptz;
begin
  select * into claimed from public.notification_deliveries
  where id = p_delivery_id and channel = 'push' and lock_token = p_lock_token
    and status in ('processing', 'sent') for update;
  if not found then return false; end if;
  retry_at := p_now + make_interval(secs => least(3600, 30 * power(2, greatest(claimed.attempt_count - 1, 0)))::integer);
  update public.notification_deliveries
  set status = 'failed',
      attempt_count = case when p_retryable then attempt_count else max_attempts end,
      next_attempt_at = case when p_retryable and attempt_count < max_attempts then retry_at else p_now end,
      locked_at = null, lock_token = null, error_code = left(p_error_code, 120),
      error_message = left(p_error_message, 4000)
  where id = claimed.id;
  insert into public.notification_delivery_attempts (
    delivery_id, attempt_number, provider, status, error_code, error_message, started_at, finished_at
  ) values (claimed.id, claimed.attempt_count, 'expo', 'failed', left(p_error_code, 120),
            left(p_error_message, 4000), claimed.last_attempt_at, p_now)
  on conflict (delivery_id, attempt_number) do nothing;
  if p_revoke_device then
    update public.user_devices set enabled = false, revoked_at = p_now where id = claimed.device_id;
    update public.notification_deliveries set status = 'canceled', error_code = 'DEVICE_REVOKED',
      error_message = 'The Expo provider reported that this device is no longer registered.'
    where device_id = claimed.device_id and channel = 'push' and status in ('pending', 'failed', 'sent');
  end if;
  return true;
end;
$$;

revoke all on function public.claim_push_notification_deliveries(integer, timestamptz) from public, anon, authenticated;
revoke all on function public.record_push_notification_ticket(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_push_notification_receipts(integer, timestamptz) from public, anon, authenticated;
revoke all on function public.complete_push_notification_receipt(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.release_push_notification_receipt(uuid, uuid, text, timestamptz) from public, anon, authenticated;
revoke all on function public.fail_push_notification_delivery(uuid, uuid, text, text, boolean, boolean, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_push_notification_deliveries(integer, timestamptz) to service_role;
grant execute on function public.record_push_notification_ticket(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.claim_push_notification_receipts(integer, timestamptz) to service_role;
grant execute on function public.complete_push_notification_receipt(uuid, uuid, timestamptz) to service_role;
grant execute on function public.release_push_notification_receipt(uuid, uuid, text, timestamptz) to service_role;
grant execute on function public.fail_push_notification_delivery(uuid, uuid, text, text, boolean, boolean, timestamptz) to service_role;

grant insert (user_id, event_type, in_app_enabled, email_enabled, push_enabled)
on public.notification_event_preferences to authenticated;
grant update (user_id, event_type, in_app_enabled, email_enabled, push_enabled)
on public.notification_event_preferences to authenticated;
grant update (push_enabled) on public.notification_preferences to authenticated;

comment on table public.user_devices is 'Expo push tokens registered to authenticated Boardnest users.';
comment on column public.notification_deliveries.device_id is 'Target device for push deliveries; null for non-device channels.';
comment on function public.claim_push_notification_deliveries(integer, timestamptz) is 'Atomically claims eligible Expo push deliveries with SKIP LOCKED.';

commit;
