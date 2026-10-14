begin;

alter table public.notification_deliveries
  add column lock_token uuid;

create table public.notification_delivery_attempts (
  id uuid primary key default extensions.gen_random_uuid(),
  delivery_id uuid not null references public.notification_deliveries (id) on delete cascade,
  attempt_number integer not null,
  provider text not null,
  status text not null,
  provider_message_id text,
  error_code text,
  error_message text,
  started_at timestamptz not null,
  finished_at timestamptz not null default statement_timestamp(),

  constraint notification_delivery_attempts_number_check
    check (attempt_number > 0),
  constraint notification_delivery_attempts_provider_check
    check (provider = 'smtp'),
  constraint notification_delivery_attempts_status_check
    check (status in ('delivered', 'failed')),
  constraint notification_delivery_attempts_provider_message_length_check
    check (provider_message_id is null or char_length(provider_message_id) <= 500),
  constraint notification_delivery_attempts_error_code_length_check
    check (error_code is null or char_length(error_code) <= 120),
  constraint notification_delivery_attempts_error_message_length_check
    check (error_message is null or char_length(error_message) <= 4000),
  constraint notification_delivery_attempts_time_check
    check (finished_at >= started_at),
  constraint notification_delivery_attempts_result_check
    check (
      (status = 'delivered' and provider_message_id is not null and error_code is null and error_message is null)
      or (status = 'failed' and provider_message_id is null and error_code is not null)
    ),
  unique (delivery_id, attempt_number)
);

alter table public.notification_delivery_attempts enable row level security;

create index notification_delivery_attempts_delivery_idx
  on public.notification_delivery_attempts (delivery_id, attempt_number desc);

create policy "notification_delivery_attempts_select_recipient"
on public.notification_delivery_attempts for select to authenticated
using (
  exists (
    select 1
    from public.notification_deliveries as delivery
    where delivery.id = notification_delivery_attempts.delivery_id
      and delivery.user_id = (select auth.uid())
  )
);

revoke all on table public.notification_delivery_attempts from anon, authenticated;
grant select on table public.notification_delivery_attempts to authenticated;
grant select, insert, update, delete on table public.notification_delivery_attempts to service_role;

create function public.claim_notification_deliveries(
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

  return query
  with candidates as (
    select delivery.id
    from public.notification_deliveries as delivery
    where delivery.channel = 'email'
      and delivery.scheduled_for <= p_now
      and delivery.next_attempt_at <= p_now
      and delivery.attempt_count < delivery.max_attempts
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

create function public.complete_notification_delivery(
  p_delivery_id uuid,
  p_lock_token uuid,
  p_provider_message_id text,
  p_now timestamptz default statement_timestamp()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed public.notification_deliveries%rowtype;
begin
  if p_provider_message_id is null
    or char_length(btrim(p_provider_message_id)) not between 1 and 500 then
    raise exception 'Provider message ID must contain between 1 and 500 characters'
      using errcode = '22023';
  end if;

  update public.notification_deliveries as delivery
  set status = 'delivered',
      delivered_at = p_now,
      provider_message_id = btrim(p_provider_message_id),
      locked_at = null,
      lock_token = null,
      error_code = null,
      error_message = null
  where delivery.id = p_delivery_id
    and delivery.status = 'processing'
    and delivery.lock_token = p_lock_token
  returning delivery.* into claimed;

  if not found then
    return false;
  end if;

  insert into public.notification_delivery_attempts (
    delivery_id,
    attempt_number,
    provider,
    status,
    provider_message_id,
    started_at,
    finished_at
  )
  values (
    claimed.id,
    claimed.attempt_count,
    'smtp',
    'delivered',
    claimed.provider_message_id,
    claimed.last_attempt_at,
    p_now
  );

  return true;
end;
$$;

create function public.fail_notification_delivery(
  p_delivery_id uuid,
  p_lock_token uuid,
  p_error_code text,
  p_error_message text,
  p_retryable boolean,
  p_now timestamptz default statement_timestamp()
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed public.notification_deliveries%rowtype;
  retry_at timestamptz;
begin
  if p_error_code is null
    or char_length(btrim(p_error_code)) not between 1 and 120 then
    raise exception 'Delivery error code must contain between 1 and 120 characters'
      using errcode = '22023';
  end if;

  if p_error_message is not null and char_length(p_error_message) > 4000 then
    raise exception 'Delivery error message cannot exceed 4000 characters'
      using errcode = '22023';
  end if;

  select delivery.* into claimed
  from public.notification_deliveries as delivery
  where delivery.id = p_delivery_id
    and delivery.status = 'processing'
    and delivery.lock_token = p_lock_token
  for update;

  if not found then
    return false;
  end if;

  retry_at := p_now + make_interval(
    secs => least(3600, 30 * power(2, greatest(claimed.attempt_count - 1, 0)))::integer
  );

  update public.notification_deliveries as delivery
  set status = 'failed',
      attempt_count = case
        when p_retryable then delivery.attempt_count
        else delivery.max_attempts
      end,
      next_attempt_at = case
        when p_retryable and delivery.attempt_count < delivery.max_attempts then retry_at
        else p_now
      end,
      locked_at = null,
      lock_token = null,
      error_code = btrim(p_error_code),
      error_message = left(p_error_message, 4000)
  where delivery.id = claimed.id;

  insert into public.notification_delivery_attempts (
    delivery_id,
    attempt_number,
    provider,
    status,
    error_code,
    error_message,
    started_at,
    finished_at
  )
  values (
    claimed.id,
    claimed.attempt_count,
    'smtp',
    'failed',
    btrim(p_error_code),
    left(p_error_message, 4000),
    claimed.last_attempt_at,
    p_now
  );

  return true;
end;
$$;

revoke all on function public.claim_notification_deliveries(integer, timestamptz)
from public, anon, authenticated;
revoke all on function public.complete_notification_delivery(uuid, uuid, text, timestamptz)
from public, anon, authenticated;
revoke all on function public.fail_notification_delivery(uuid, uuid, text, text, boolean, timestamptz)
from public, anon, authenticated;

grant execute on function public.claim_notification_deliveries(integer, timestamptz)
to service_role;
grant execute on function public.complete_notification_delivery(uuid, uuid, text, timestamptz)
to service_role;
grant execute on function public.fail_notification_delivery(uuid, uuid, text, text, boolean, timestamptz)
to service_role;

comment on table public.notification_delivery_attempts is
  'Immutable SMTP attempt history for notification email deliveries.';
comment on column public.notification_deliveries.lock_token is
  'Lease token required to complete or fail the exact claimed delivery attempt.';
comment on function public.claim_notification_deliveries(integer, timestamptz) is
  'Claims a bounded due email batch with SKIP LOCKED and reclaims stale five-minute leases.';
comment on function public.complete_notification_delivery(uuid, uuid, text, timestamptz) is
  'Marks the matching claimed attempt delivered and appends immutable attempt history.';
comment on function public.fail_notification_delivery(uuid, uuid, text, text, boolean, timestamptz) is
  'Records a failed attempt and schedules bounded exponential retry backoff when eligible.';

commit;
