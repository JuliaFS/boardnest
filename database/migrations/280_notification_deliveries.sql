begin;

-- Durable email outbox. Workers claim pending rows and update delivery state.
create table public.notification_deliveries (
  id uuid primary key default extensions.gen_random_uuid(),
  reminder_id uuid references public.task_reminders (id) on delete set null,
  notification_id uuid references public.notifications (id) on delete set null,
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null default 'email',
  status text not null default 'pending',
  scheduled_for timestamptz not null,
  next_attempt_at timestamptz not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  locked_at timestamptz,
  last_attempt_at timestamptz,
  delivered_at timestamptz,
  provider_message_id text,
  error_code text,
  error_message text,
  idempotency_key text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  constraint notification_deliveries_channel_check
    check (channel = 'email'),
  constraint notification_deliveries_status_check
    check (status in ('pending', 'processing', 'delivered', 'failed', 'canceled')),
  constraint notification_deliveries_attempts_check
    check (attempt_count >= 0 and max_attempts between 1 and 20 and attempt_count <= max_attempts),
  constraint notification_deliveries_provider_message_length_check
    check (provider_message_id is null or char_length(provider_message_id) <= 500),
  constraint notification_deliveries_error_code_length_check
    check (error_code is null or char_length(error_code) <= 120),
  constraint notification_deliveries_error_message_length_check
    check (error_message is null or char_length(error_message) <= 4000),
  constraint notification_deliveries_idempotency_key_length_check
    check (char_length(btrim(idempotency_key)) between 16 and 255),
  constraint notification_deliveries_payload_object_check
    check (jsonb_typeof(payload) = 'object'),
  constraint notification_deliveries_delivered_state_check
    check (
      (status = 'delivered' and delivered_at is not null)
      or (status <> 'delivered' and delivered_at is null)
    )
);

alter table public.notification_deliveries enable row level security;

create unique index notification_deliveries_idempotency_unique_idx
  on public.notification_deliveries (idempotency_key);
create index notification_deliveries_pending_idx
  on public.notification_deliveries (next_attempt_at, id)
  where status in ('pending', 'failed');
create index notification_deliveries_workspace_created_idx
  on public.notification_deliveries (workspace_id, created_at desc);
create index notification_deliveries_user_created_idx
  on public.notification_deliveries (user_id, created_at desc);

create function private.enforce_email_delivery_limits()
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
    select 1
    from public.workspace_members as wm
    where wm.workspace_id = new.workspace_id
      and wm.user_id = new.user_id
  ) then
    raise exception 'Notification recipient must be a workspace member'
      using errcode = '23514';
  end if;

  if new.reminder_id is not null and not exists (
    select 1
    from public.task_reminders as tr
    join public.task_reminder_recipients as recipient
      on recipient.reminder_id = tr.id
    where tr.id = new.reminder_id
      and tr.workspace_id = new.workspace_id
      and recipient.user_id = new.user_id
  ) then
    raise exception 'Delivery recipient is not selected for this reminder'
      using errcode = '23514';
  end if;

  effective_plan := private.effective_workspace_plan(new.workspace_id);
  select sp.email_enabled, sp.monthly_email_limit
  into plan_email_enabled, plan_monthly_limit
  from public.subscription_plans as sp
  where sp.code = effective_plan;

  if not found then
    raise exception 'Workspace does not have an effective subscription plan'
      using errcode = '23514';
  end if;

  if not plan_email_enabled then
    raise exception 'The % plan does not include email notifications', effective_plan
      using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.workspace_id::text, 3));
  month_start := date_trunc(
    'month',
    statement_timestamp() at time zone 'UTC'
  ) at time zone 'UTC';

  select count(*)
  into queued_this_month
  from public.notification_deliveries as delivery
  where delivery.workspace_id = new.workspace_id
    and delivery.channel = 'email'
    and delivery.status <> 'canceled'
    and delivery.created_at >= month_start;

  if queued_this_month >= plan_monthly_limit then
    raise exception 'Monthly email limit reached: % delivery/deliveries.', plan_monthly_limit
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke execute on function private.enforce_email_delivery_limits() from public;

create trigger notification_deliveries_enforce_limits
before insert on public.notification_deliveries
for each row execute function private.enforce_email_delivery_limits();

create trigger notification_deliveries_set_updated_at
before update on public.notification_deliveries
for each row execute function private.set_updated_at();

comment on table public.notification_deliveries is
  'Durable email delivery outbox with idempotency, retry, and provider status metadata.';
comment on column public.notification_deliveries.idempotency_key is
  'Stable occurrence key preventing a reminder email from being queued twice.';

commit;
