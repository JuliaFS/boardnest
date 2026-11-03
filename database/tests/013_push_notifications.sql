begin;

select plan(11);

select has_table('public', 'user_devices', 'user device registry exists');
select has_column('public', 'notification_deliveries', 'device_id', 'delivery outbox targets a device');
select has_column('public', 'notification_preferences', 'push_enabled', 'global push preference exists');
select has_column('public', 'notification_event_preferences', 'push_enabled', 'event push preference exists');
select has_column('public', 'plan_notification_events', 'push_enabled', 'plan push entitlement exists');
select has_function('public', 'register_push_device', array['text', 'text', 'text'], 'device registration RPC exists');
select has_function('public', 'revoke_push_device', array['uuid'], 'device revocation RPC exists');
select has_function('public', 'claim_push_notification_deliveries', array['integer', 'timestamp with time zone'], 'push claim RPC exists');
select has_function('public', 'claim_push_notification_receipts', array['integer', 'timestamp with time zone'], 'receipt claim RPC exists');
select has_function('public', 'complete_push_notification_receipt', array['uuid', 'uuid', 'timestamp with time zone'], 'receipt completion RPC exists');
select has_function('public', 'release_push_notification_receipt', array['uuid', 'uuid', 'text', 'timestamp with time zone'], 'receipt recovery RPC exists');

select * from finish();
rollback;
