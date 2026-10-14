begin;

insert into auth.users (id, email, is_anonymous, raw_user_meta_data)
values (
  '00000000-0000-4000-8000-000000000081',
  'delivery-worker@example.com',
  false,
  '{"display_name":"Delivery Worker User"}'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000081', true);

insert into public.workspaces (id, name, slug, created_by)
values (
  '10000000-0000-4000-8000-000000000081',
  'Delivery Worker Workspace',
  'delivery-worker-workspace',
  '00000000-0000-4000-8000-000000000081'
);

reset role;
set local role service_role;

insert into public.notification_deliveries (
  workspace_id,
  user_id,
  scheduled_for,
  next_attempt_at,
  idempotency_key,
  payload
)
values (
  '10000000-0000-4000-8000-000000000081',
  '00000000-0000-4000-8000-000000000081',
  '2030-01-15T08:00:00Z',
  '2030-01-15T08:00:00Z',
  'delivery-worker:00000000-0000-4000-8000-000000000081',
  '{"title":"Worker test","body":"First attempt fails."}'::jsonb
);

do $$
declare
  first_claim record;
  second_claim record;
  completed boolean;
begin
  select * into first_claim
  from public.claim_notification_deliveries(10, '2030-01-15T08:00:00Z');

  if first_claim.id is null
    or first_claim.recipient_email <> 'delivery-worker@example.com'
    or first_claim.attempt_count <> 1
    or first_claim.lock_token is null then
    raise exception 'Expected the first delivery attempt to be claimed with recipient and lease data';
  end if;

  if not public.fail_notification_delivery(
    first_claim.id,
    first_claim.lock_token,
    'ETIMEDOUT',
    'Temporary SMTP timeout',
    true,
    '2030-01-15T08:00:01Z'
  ) then
    raise exception 'Expected the first attempt failure to be recorded';
  end if;

  if exists (
    select 1
    from public.claim_notification_deliveries(10, '2030-01-15T08:00:29Z')
  ) then
    raise exception 'Delivery became claimable before its retry backoff elapsed';
  end if;

  select * into second_claim
  from public.claim_notification_deliveries(10, '2030-01-15T08:00:31Z');

  if second_claim.id <> first_claim.id
    or second_claim.attempt_count <> 2
    or second_claim.lock_token = first_claim.lock_token then
    raise exception 'Expected the failed delivery to be reclaimed with a new lease';
  end if;

  completed := public.complete_notification_delivery(
    second_claim.id,
    second_claim.lock_token,
    'smtp-test-message-id',
    '2030-01-15T08:00:32Z'
  );

  if not completed then
    raise exception 'Expected the second attempt to complete';
  end if;

  if public.complete_notification_delivery(
    second_claim.id,
    second_claim.lock_token,
    'duplicate-message-id',
    '2030-01-15T08:00:33Z'
  ) then
    raise exception 'A completed lease was accepted twice';
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from public.notification_deliveries
    where idempotency_key = 'delivery-worker:00000000-0000-4000-8000-000000000081'
      and status = 'delivered'
      and attempt_count = 2
      and provider_message_id = 'smtp-test-message-id'
      and lock_token is null
  ) then
    raise exception 'Expected a delivered outbox row after the successful retry';
  end if;

  if (
    select count(*)
    from public.notification_delivery_attempts as attempt
    join public.notification_deliveries as delivery on delivery.id = attempt.delivery_id
    where delivery.idempotency_key = 'delivery-worker:00000000-0000-4000-8000-000000000081'
  ) <> 2 then
    raise exception 'Expected immutable history for both delivery attempts';
  end if;
end;
$$;

rollback;
