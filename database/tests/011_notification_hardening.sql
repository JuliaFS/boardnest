begin;

insert into auth.users (id, email, is_anonymous, raw_user_meta_data)
values
  (
    '00000000-0000-4000-8000-000000000111',
    'preference-hardening@example.com',
    false,
    '{"display_name":"Preference Hardening User"}'
  ),
  (
    '00000000-0000-4000-8000-000000000112',
    'delivery-hardening@example.com',
    false,
    '{"display_name":"Delivery Hardening User"}'
  );

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000111', true);

insert into public.workspaces (id, name, slug, created_by)
values (
  '10000000-0000-4000-8000-000000000111',
  'Preference Hardening Workspace',
  'preference-hardening-workspace',
  '00000000-0000-4000-8000-000000000111'
);

reset role;
set local role service_role;

select public.create_notification_event(
  'hardening:global-preference:first',
  '00000000-0000-4000-8000-000000000111',
  '10000000-0000-4000-8000-000000000111',
  'workspace.member_added',
  'Queued before global unsubscribe',
  null,
  null,
  null,
  null,
  '2032-01-15T08:00:00Z'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000111', true);

update public.notification_preferences
set email_enabled = false
where user_id = '00000000-0000-4000-8000-000000000111';

do $$
begin
  if not exists (
    select 1
    from public.notification_deliveries
    where user_id = '00000000-0000-4000-8000-000000000111'
      and payload ->> 'title' = 'Queued before global unsubscribe'
      and status = 'canceled'
      and error_code = 'EMAIL_PREFERENCE_DISABLED'
  ) then
    raise exception 'Global email opt-out did not cancel queued delivery';
  end if;
end;
$$;

update public.notification_preferences
set email_enabled = true
where user_id = '00000000-0000-4000-8000-000000000111';

reset role;
set local role service_role;

select public.create_notification_event(
  'hardening:event-preference:second',
  '00000000-0000-4000-8000-000000000111',
  '10000000-0000-4000-8000-000000000111',
  'workspace.member_added',
  'Queued before event unsubscribe',
  null,
  null,
  null,
  null,
  '2032-01-15T08:00:00Z'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000111', true);

insert into public.notification_event_preferences (
  user_id,
  event_type,
  in_app_enabled,
  email_enabled
)
values (
  '00000000-0000-4000-8000-000000000111',
  'workspace.member_added',
  true,
  false
);

do $$
begin
  if not exists (
    select 1
    from public.notification_deliveries
    where user_id = '00000000-0000-4000-8000-000000000111'
      and payload ->> 'title' = 'Queued before event unsubscribe'
      and status = 'canceled'
      and error_code = 'EVENT_PREFERENCE_DISABLED'
  ) then
    raise exception 'Event email opt-out did not cancel queued delivery';
  end if;

  if (
    select count(*)
    from public.notifications
    where user_id = '00000000-0000-4000-8000-000000000111'
      and event_key in (
        'hardening:global-preference:first',
        'hardening:event-preference:second'
      )
  ) <> 2 then
    raise exception 'Email opt-out unexpectedly removed in-app notifications';
  end if;
end;
$$;

reset role;
set local role service_role;

select public.create_notification_event(
  'hardening:event-preference:third',
  '00000000-0000-4000-8000-000000000111',
  '10000000-0000-4000-8000-000000000111',
  'workspace.member_added',
  'Created after event unsubscribe',
  null,
  null,
  null,
  null,
  '2032-01-15T08:00:00Z'
);

do $$
begin
  if exists (
    select 1
    from public.notification_deliveries
    where user_id = '00000000-0000-4000-8000-000000000111'
      and payload ->> 'title' = 'Created after event unsubscribe'
  ) then
    raise exception 'Event email opt-out allowed a new delivery';
  end if;

  if exists (
    select 1
    from public.claim_notification_deliveries(10, '2032-01-15T08:00:00Z')
    where recipient_email = 'preference-hardening@example.com'
  ) then
    raise exception 'A canceled or opted-out delivery was claimed';
  end if;
end;
$$;

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000112', true);

insert into public.workspaces (id, name, slug, created_by)
values (
  '10000000-0000-4000-8000-000000000112',
  'Delivery Hardening Workspace',
  'delivery-hardening-workspace',
  '00000000-0000-4000-8000-000000000112'
);

reset role;
set local role service_role;

-- Use a small limit inside this rolled-back test to exercise the exact quota
-- boundary without creating a large fixture.
update public.subscription_plans
set monthly_email_limit = 3
where code = 'free';

insert into public.notification_deliveries (
  workspace_id,
  user_id,
  scheduled_for,
  next_attempt_at,
  max_attempts,
  idempotency_key,
  payload
)
select
  '10000000-0000-4000-8000-000000000112',
  '00000000-0000-4000-8000-000000000112',
  '2032-01-15T08:00:00Z',
  case
    when delivery_number = 3 then '2032-01-15T09:00:00Z'::timestamptz
    else '2032-01-15T08:00:00Z'::timestamptz + delivery_number * interval '1 second'
  end,
  case when delivery_number = 2 then 2 else 5 end,
  'hardening-delivery-' || delivery_number || '-unique-key',
  jsonb_build_object(
    'eventType', 'workspace.member_added',
    'title', 'Hardening delivery ' || delivery_number
  )
from generate_series(1, 1) as fixture(delivery_number);

-- Producer retries are safe at the unique outbox boundary.
insert into public.notification_deliveries (
  workspace_id,
  user_id,
  scheduled_for,
  next_attempt_at,
  idempotency_key,
  payload
)
values (
  '10000000-0000-4000-8000-000000000112',
  '00000000-0000-4000-8000-000000000112',
  '2032-01-15T08:00:00Z',
  '2032-01-15T08:00:00Z',
  'hardening-delivery-1-unique-key',
  '{"eventType":"workspace.member_added"}'::jsonb
)
on conflict (idempotency_key) do nothing;

insert into public.notification_deliveries (
  workspace_id,
  user_id,
  scheduled_for,
  next_attempt_at,
  max_attempts,
  idempotency_key,
  payload
)
select
  '10000000-0000-4000-8000-000000000112',
  '00000000-0000-4000-8000-000000000112',
  '2032-01-15T08:00:00Z',
  case
    when delivery_number = 3 then '2032-01-15T09:00:00Z'::timestamptz
    else '2032-01-15T08:00:00Z'::timestamptz + delivery_number * interval '1 second'
  end,
  case when delivery_number = 2 then 2 else 5 end,
  'hardening-delivery-' || delivery_number || '-unique-key',
  jsonb_build_object(
    'eventType', 'workspace.member_added',
    'title', 'Hardening delivery ' || delivery_number
  )
from generate_series(2, 3) as fixture(delivery_number);

do $$
begin
  if (
    select count(*)
    from public.notification_deliveries
    where workspace_id = '10000000-0000-4000-8000-000000000112'
  ) <> 3 then
    raise exception 'Duplicate producer retry created another delivery';
  end if;

  begin
    insert into public.notification_deliveries (
      workspace_id,
      user_id,
      scheduled_for,
      next_attempt_at,
      idempotency_key,
      payload
    ) values (
      '10000000-0000-4000-8000-000000000112',
      '00000000-0000-4000-8000-000000000112',
      '2032-01-15T08:00:00Z',
      '2032-01-15T08:00:00Z',
      'hardening-over-quota-unique-key',
      '{"eventType":"workspace.member_added"}'::jsonb
    );
    raise exception 'Monthly email quota accepted a fourth active delivery'
      using errcode = 'XX000';
  exception
    when sqlstate 'P0001' then null;
    when sqlstate 'XX000' then raise;
  end;
end;
$$;

do $$
declare
  first_claim record;
  second_claim record;
begin
  select * into first_claim
  from public.claim_notification_deliveries(1, '2032-01-15T08:00:10Z');

  select * into second_claim
  from public.claim_notification_deliveries(1, '2032-01-15T08:00:10Z');

  if first_claim.id is null or second_claim.id is null
    or first_claim.id = second_claim.id then
    raise exception 'Independent claims did not receive distinct delivery leases';
  end if;

  if not public.complete_notification_delivery(
    first_claim.id,
    first_claim.lock_token,
    'hardening-provider-message-1',
    '2032-01-15T08:00:11Z'
  ) then
    raise exception 'The first claimed delivery did not complete';
  end if;

  if public.complete_notification_delivery(
    first_claim.id,
    first_claim.lock_token,
    'hardening-provider-message-duplicate',
    '2032-01-15T08:00:12Z'
  ) then
    raise exception 'The same delivery lease completed twice';
  end if;

  if second_claim.max_attempts <> 2 then
    raise exception 'Expected the bounded-retry fixture to be claimed second';
  end if;

  if not public.fail_notification_delivery(
    second_claim.id,
    second_claim.lock_token,
    'ETIMEDOUT',
    'Temporary provider timeout',
    true,
    '2032-01-15T08:00:11Z'
  ) then
    raise exception 'The first retryable failure was not recorded';
  end if;

  select * into second_claim
  from public.claim_notification_deliveries(1, '2032-01-15T08:00:41Z');

  if second_claim.attempt_count <> 2 then
    raise exception 'Expected the final retry attempt after backoff';
  end if;

  if not public.fail_notification_delivery(
    second_claim.id,
    second_claim.lock_token,
    'ETIMEDOUT',
    'Provider timeout after final attempt',
    true,
    '2032-01-15T08:00:42Z'
  ) then
    raise exception 'The terminal failure was not recorded';
  end if;

  if not exists (
    select 1
    from public.notification_deliveries
    where id = second_claim.id
      and status = 'failed'
      and attempt_count = max_attempts
      and lock_token is null
  ) then
    raise exception 'A delivery did not become terminal at max_attempts';
  end if;
end;
$$;

do $$
declare
  metrics record;
begin
  select * into metrics
  from public.notification_delivery_health('2032-01-15T08:01:00Z');

  if metrics.terminal_failed <> 1
    or metrics.pending_due <> 0
    or metrics.pending_scheduled <> 1
    or metrics.retryable_failed <> 0
    or metrics.delivered_last_24_hours <> 1
    or metrics.failed_attempts_last_24_hours <> 2 then
    raise exception 'Operational delivery metrics do not reflect worker history';
  end if;

  if metrics.processing <> 0 or metrics.stale_processing <> 0 then
    raise exception 'Completed and failed leases remained in processing';
  end if;
end;
$$;

rollback;
