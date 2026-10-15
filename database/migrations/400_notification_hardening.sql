begin;

-- Processing leases are inspected by the worker and by operational health
-- checks. Keep that path bounded when the outbox grows.
create index notification_deliveries_processing_locked_idx
  on public.notification_deliveries (locked_at, id)
  where status = 'processing';

create function private.notification_delivery_email_enabled(
  target_user_id uuid,
  target_workspace_id uuid,
  target_reminder_id uuid,
  target_payload jsonb
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select channels.email_enabled
    from private.notification_event_channels(
      target_user_id,
      target_workspace_id,
      coalesce(
        target_payload ->> 'eventType',
        case when target_reminder_id is not null then 'task.reminder' end
      )
    ) as channels
  ), false)
$$;

revoke execute on function private.notification_delivery_email_enabled(
  uuid, uuid, uuid, jsonb
) from public;

create function private.cancel_deliveries_after_global_preference_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.email_enabled and not new.email_enabled then
    update public.notification_deliveries as delivery
    set status = 'canceled',
        error_code = 'EMAIL_PREFERENCE_DISABLED',
        error_message = 'Email notifications were disabled before delivery.'
    where delivery.user_id = new.user_id
      and (
        delivery.status = 'pending'
        or (
          delivery.status = 'failed'
          and delivery.attempt_count < delivery.max_attempts
        )
      );
  else
    if old.reminder_enabled and not new.reminder_enabled then
      update public.notification_deliveries as delivery
      set status = 'canceled',
          error_code = 'EVENT_PREFERENCE_DISABLED',
          error_message = 'This notification type was disabled before delivery.'
      where delivery.user_id = new.user_id
        and (
          delivery.status = 'pending'
          or (
            delivery.status = 'failed'
            and delivery.attempt_count < delivery.max_attempts
          )
        )
        and (
          delivery.reminder_id is not null
          or delivery.payload ->> 'eventType' = 'task.reminder'
        );
    end if;

    if old.task_created_enabled and not new.task_created_enabled then
      update public.notification_deliveries as delivery
      set status = 'canceled',
          error_code = 'EVENT_PREFERENCE_DISABLED',
          error_message = 'This notification type was disabled before delivery.'
      where delivery.user_id = new.user_id
        and (
          delivery.status = 'pending'
          or (
            delivery.status = 'failed'
            and delivery.attempt_count < delivery.max_attempts
          )
        )
        and delivery.payload ->> 'eventType' = 'task.created';
    end if;

    if old.task_assigned_enabled and not new.task_assigned_enabled then
      update public.notification_deliveries as delivery
      set status = 'canceled',
          error_code = 'EVENT_PREFERENCE_DISABLED',
          error_message = 'This notification type was disabled before delivery.'
      where delivery.user_id = new.user_id
        and (
          delivery.status = 'pending'
          or (
            delivery.status = 'failed'
            and delivery.attempt_count < delivery.max_attempts
          )
        )
        and delivery.payload ->> 'eventType' = 'task.assigned';
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function private.cancel_deliveries_after_global_preference_change()
from public;

create trigger notification_preferences_cancel_disabled_deliveries
after update of email_enabled, reminder_enabled, task_created_enabled, task_assigned_enabled
on public.notification_preferences
for each row execute function private.cancel_deliveries_after_global_preference_change();

create function private.cancel_deliveries_after_event_preference_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if new.email_enabled then
      return new;
    end if;
  elsif not old.email_enabled or new.email_enabled then
    return new;
  end if;

  update public.notification_deliveries as delivery
  set status = 'canceled',
      error_code = 'EVENT_PREFERENCE_DISABLED',
      error_message = 'This notification type was disabled before delivery.'
  where delivery.user_id = new.user_id
    and (
      delivery.status = 'pending'
      or (
        delivery.status = 'failed'
        and delivery.attempt_count < delivery.max_attempts
      )
    )
    and coalesce(
      delivery.payload ->> 'eventType',
      case when delivery.reminder_id is not null then 'task.reminder' end
    ) = new.event_type;

  return new;
end;
$$;

revoke execute on function private.cancel_deliveries_after_event_preference_change()
from public;

create trigger notification_event_preferences_cancel_disabled_deliveries
after insert or update on public.notification_event_preferences
for each row execute function private.cancel_deliveries_after_event_preference_change();

-- Re-check preferences and plan entitlements immediately before claiming. This
-- closes the gap between queue creation and a later unsubscribe or downgrade.
create or replace function public.claim_notification_deliveries(
  p_batch_size integer default 25,
  p_now timestamptz default statement_timestamp()
)
returns table (
  id uuid,
  lock_token uuid,
  idempotency_key text,
  recipient_email text,
  payload jsonb,
  attempt_count integer,
  max_attempts integer,
  scheduled_for timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_batch_size not between 1 and 100 then
    raise exception 'Delivery batch size must be between 1 and 100'
      using errcode = '22023';
  end if;

  update public.notification_deliveries as delivery
  set status = 'canceled',
      locked_at = null,
      lock_token = null,
      error_code = 'EMAIL_NOT_ELIGIBLE',
      error_message = 'Email delivery is no longer permitted by preferences or plan.'
  where delivery.channel = 'email'
    and (
      delivery.status = 'pending'
      or (
        delivery.status = 'failed'
        and delivery.attempt_count < delivery.max_attempts
      )
      or (
        delivery.status = 'processing'
        and delivery.locked_at <= p_now - interval '5 minutes'
      )
    )
    and delivery.scheduled_for <= p_now
    and delivery.next_attempt_at <= p_now
    and not private.notification_delivery_email_enabled(
      delivery.user_id,
      delivery.workspace_id,
      delivery.reminder_id,
      delivery.payload
    );

  return query
  with candidates as (
    select delivery.id
    from public.notification_deliveries as delivery
    where delivery.channel = 'email'
      and delivery.scheduled_for <= p_now
      and delivery.next_attempt_at <= p_now
      and delivery.attempt_count < delivery.max_attempts
      and private.notification_delivery_email_enabled(
        delivery.user_id,
        delivery.workspace_id,
        delivery.reminder_id,
        delivery.payload
      )
      and (
        delivery.status in ('pending', 'failed')
        or (
          delivery.status = 'processing'
          and delivery.locked_at <= p_now - interval '5 minutes'
        )
      )
    order by delivery.next_attempt_at, delivery.id
    for update skip locked
    limit p_batch_size
  ), claimed as (
    update public.notification_deliveries as delivery
    set status = 'processing',
        attempt_count = delivery.attempt_count + 1,
        locked_at = p_now,
        last_attempt_at = p_now,
        lock_token = extensions.gen_random_uuid(),
        error_code = null,
        error_message = null
    from candidates
    where delivery.id = candidates.id
    returning delivery.*
  )
  select
    claimed.id,
    claimed.lock_token,
    claimed.idempotency_key,
    auth_user.email::text,
    claimed.payload,
    claimed.attempt_count,
    claimed.max_attempts,
    claimed.scheduled_for
  from claimed
  join auth.users as auth_user on auth_user.id = claimed.user_id
  order by claimed.next_attempt_at, claimed.id;
end;
$$;

create function public.notification_delivery_health(
  p_now timestamptz default statement_timestamp()
)
returns table (
  pending_due bigint,
  pending_scheduled bigint,
  retryable_failed bigint,
  terminal_failed bigint,
  processing bigint,
  stale_processing bigint,
  delivered_last_24_hours bigint,
  failed_attempts_last_24_hours bigint,
  oldest_due_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    count(*) filter (
      where delivery.status = 'pending'
        and delivery.scheduled_for <= p_now
        and delivery.next_attempt_at <= p_now
    ),
    count(*) filter (
      where delivery.status = 'pending'
        and (delivery.scheduled_for > p_now or delivery.next_attempt_at > p_now)
    ),
    count(*) filter (
      where delivery.status = 'failed'
        and delivery.attempt_count < delivery.max_attempts
    ),
    count(*) filter (
      where delivery.status = 'failed'
        and delivery.attempt_count >= delivery.max_attempts
    ),
    count(*) filter (where delivery.status = 'processing'),
    count(*) filter (
      where delivery.status = 'processing'
        and delivery.locked_at <= p_now - interval '5 minutes'
    ),
    count(*) filter (
      where delivery.status = 'delivered'
        and delivery.delivered_at >= p_now - interval '24 hours'
    ),
    (
      select count(*)
      from public.notification_delivery_attempts as attempt
      where attempt.status = 'failed'
        and attempt.finished_at >= p_now - interval '24 hours'
    ),
    min(delivery.next_attempt_at) filter (
      where delivery.status in ('pending', 'failed')
        and delivery.scheduled_for <= p_now
        and delivery.next_attempt_at <= p_now
        and delivery.attempt_count < delivery.max_attempts
    )
  from public.notification_deliveries as delivery
$$;

revoke all on function public.notification_delivery_health(timestamptz)
from public, anon, authenticated;
grant execute on function public.notification_delivery_health(timestamptz)
to service_role;

comment on function private.notification_delivery_email_enabled(uuid, uuid, uuid, jsonb) is
  'Revalidates global, event, legacy, and plan email gates for an outbox row.';
comment on function public.notification_delivery_health(timestamptz) is
  'Returns aggregate service-role-only outbox metrics without recipient or payload data.';

commit;
