# Notification operations

## Purpose

This runbook covers the production email outbox, reminder scheduler, failure
triage, and safe recovery. It never requires recipient addresses, payloads, or
provider credentials to appear in logs or monitoring output.

## Runtime signals

The API emits these aggregate messages:

- `Notification delivery batch` after a non-empty email batch;
- `Notification delivery worker error` when claiming or recording a batch
  fails;
- `Processed ... due task reminder(s)` after reminder scheduling work;
- `Reminder scheduler error` when the scheduler RPC fails;
- `Processed ... due custom notification schedule(s)` after custom schedule work;
- `Custom notification scheduler error` when its RPC fails.

Railway should retain these logs and alert on repeated worker or scheduler
errors. Do not alert on one retryable SMTP failure alone; the outbox records it
and applies exponential backoff.

`/health` is a liveness check only. It confirms that the API process can serve
HTTP, not that SMTP, Supabase, or Redis are healthy. Keep the Railway health
check pointed at `/health` and monitor the durable outbox separately.

## Outbox metrics

Migration `400_notification_hardening.sql` installs the service-role-only
`notification_delivery_health` function. Run it in the Supabase SQL editor or
through a trusted monitoring process:

```sql
select * from public.notification_delivery_health();
```

The result contains only aggregate counts and the oldest due timestamp:

- `pending_due`: ready for immediate claim;
- `pending_scheduled`: intentionally waiting for a future time;
- `retryable_failed`: failed but still within the attempt budget;
- `terminal_failed`: exhausted or permanently rejected;
- `processing`: currently leased deliveries;
- `stale_processing`: leases older than five minutes;
- `delivered_last_24_hours`;
- `failed_attempts_last_24_hours`;
- `oldest_due_at`.

Never grant this function to `anon` or `authenticated`, and never expose the
Supabase service-role key to Vercel or a browser bundle.

## Suggested alerts

Start with conservative thresholds and tune them to normal traffic:

| Signal              | Suggested condition               | First action                                          |
| ------------------- | --------------------------------- | ----------------------------------------------------- |
| Oldest due delivery | More than 10 minutes old          | Check API worker logs and Railway variables           |
| Stale processing    | Greater than 0 for two checks     | Confirm at least one healthy API replica              |
| Terminal failures   | Any increase                      | Inspect sanitized attempt history and provider status |
| Failed attempts     | Sustained increase for 15 minutes | Check SMTP availability, credentials, and rate limits |
| Delivered count     | Zero during expected traffic      | Confirm scheduler and worker flags are enabled        |

The five-minute lease is intentionally shorter than the first alert window. A
healthy worker can reclaim an abandoned attempt before an operator intervenes.

## Incident triage

1. Confirm Railway reports the API deployment as healthy and `/health` returns
   `{"service":"boardnest-api","status":"ok"}`.
2. Confirm `REMINDER_SCHEDULER_ENABLED=true`,
   `CUSTOM_NOTIFICATION_SCHEDULER_ENABLED=true`, and
   `EMAIL_DELIVERY_WORKER_ENABLED=true` on the Railway API service.
3. Run `notification_delivery_health()` and record aggregate values.
4. Search Railway logs for worker, scheduler, SMTP authentication, and Supabase
   RPC errors.
5. Check the SMTP provider status and sending limits. For Gmail, verify the App
   Password and use port `587` with `SMTP_SECURE=false`.
6. Inspect only the affected delivery IDs and their attempt history. Avoid
   copying recipient addresses or message payloads into tickets.
7. Fix the dependency or configuration. Retryable rows recover automatically;
   do not manually reset them while a worker is active.

Permanent failures stay visible for support and audit. Correct the underlying
address or configuration before creating a new business occurrence; changing
an idempotency key solely to force another email can create a duplicate.

## Concurrency and duplicate guarantees

Multiple API replicas may run the workers. Database claims use `FOR UPDATE SKIP
LOCKED`, and every attempt receives a unique lease token. Only the current
lease can complete or fail a delivery. Producer idempotency keys prevent the
same business occurrence from creating a second outbox row.

Delivery is at-least-once, not mathematically exactly-once. The worker reuses a
stable SMTP `Message-ID` on retries, but an SMTP provider can accept a message
immediately before the completion RPC becomes unavailable. Provider-side
deduplication reduces this rare case; operators must not blindly replay it.

## Unsubscribe and preference behavior

Disabling global email, a legacy reminder/task switch, or an event-specific
email preference cancels matching `pending` and retryable `failed` outbox rows.
Terminal failures remain immutable operational history. The claim RPC
revalidates preferences and plan entitlements immediately before leasing,
which also protects against plan downgrades and missed trigger paths.

An email already accepted by SMTP cannot be recalled. A currently processing
row therefore finishes its lease; if the worker disappears, an ineligible
stale lease is canceled after five minutes instead of being resent. Re-enabling
a preference does not resurrect canceled historical deliveries. Future events
use the new preference.

## Verification after deployment

1. Apply migrations through `410_custom_notification_scheduler.sql`.
2. Run `database/tests/011_notification_hardening.sql` and
   `database/tests/012_custom_notification_scheduler.sql` only against a
   disposable Supabase-compatible database.
3. Deploy one API replica and verify normal reminder and email delivery.
4. Disable email for the test account before a queued future delivery. Confirm
   its delivery history changes to `canceled`.
5. Run `notification_delivery_health()` and confirm there are no stale leases
   or unexpected terminal failures.
6. Scale to two replicas if required and confirm batches continue without
   duplicate outbox completion.
