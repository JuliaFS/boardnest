# Notification system

## Current scope

The notification event model provides one canonical vocabulary for workspace,
project, task, comment, reminder, and custom-notification events. It also
centralizes channel selection, plan entitlements, user preferences,
idempotency, and email-outbox creation.

Workspace and project membership, task creation, assignment, detail and status
changes, and comment creation now produce canonical events atomically through
database triggers. Reminder occurrences continue through the dedicated atomic
scheduler. Mentions and deadline events are reserved for a later stage because
neither domain model has been introduced yet.

Canonical events queue email work in `notification_deliveries`. The API-hosted
delivery worker claims due rows and sends them through Nodemailer SMTP.
Invitation email remains a separate synchronous flow. Custom schedules have an
authorized GraphQL CRUD API, a frontend for personal schedule management, and a
service-role scheduler that produces due canonical occurrences.

## Event catalog

`notification_event_types` contains the supported event types and their default
channel choices:

| Event type                 | Default in-app | Default email |
| -------------------------- | -------------- | ------------- |
| `workspace.member_added`   | Yes            | Yes           |
| `workspace.member_removed` | Yes            | Yes           |
| `project.member_added`     | Yes            | Yes           |
| `project.member_removed`   | Yes            | Yes           |
| `task.created`             | Yes            | No            |
| `task.assigned`            | Yes            | Yes           |
| `task.updated`             | Yes            | No            |
| `task.status_changed`      | Yes            | No            |
| `comment.created`          | Yes            | Yes           |
| `task.reminder`            | Yes            | Yes           |
| `custom.notification`      | Yes            | Yes           |

Adding an event requires a catalog row and a matching entitlement row for each
plan. It does not require a new Boolean column in user preferences.

## Plan capabilities

`plan_notification_events` is the upper bound for each channel:

- Guest permits in-app events and blocks all event email.
- Free permits in-app events and email only for event types whose catalog email
  default is enabled.
- Pro permits both channels for every active event type.

The existing workspace-wide monthly email quota remains authoritative. A user
preference can disable an entitled channel but cannot enable a channel that the
workspace plan blocks.

Custom schedule plan limits are also stored in `subscription_plans`. Guest,
Free, and Pro allow 3, 10, and 100 active schedules per user/workspace with
minimum recurring intervals of one day, one hour, and five minutes. One-time
schedules are not subject to a recurrence interval minimum.

## Preference resolution

Channel resolution applies the following gates in order:

1. the event type must be active;
2. the user's global in-app or email channel must be enabled;
3. the effective workspace plan must permit the channel for that event;
4. legacy task-created, task-assigned, and reminder switches remain respected;
5. a row in `notification_event_preferences` overrides the catalog default.

Missing event-specific preference rows inherit the catalog defaults. Users can
read and update only their own overrides through RLS and the GraphQL API.

## Producing events

Trusted server processes call the service-role-only
`public.create_notification_event` function. Producers must provide a stable
event key that identifies the business occurrence and recipient.

```sql
select public.create_notification_event(
  'task-assigned:task-id:user-id',
  'recipient-user-id',
  'workspace-id',
  'task.assigned',
  'Task assigned',
  'You were assigned to Prepare release.',
  'actor-user-id',
  'project-id',
  'task-id',
  null,
  '{"source":"task-assignment"}'::jsonb
);
```

The function validates the catalog type, recipient and actor membership,
workspace/project/task consistency, content lengths, and JSON payload. It then
creates the permitted in-app row and/or an email outbox row. The unique
recipient/event-key constraint and delivery idempotency key make retries safe.

Reminder occurrences keep using the existing atomic reminder scheduler, which
creates both reminder-specific rows itself. The general notification trigger
skips rows carrying `reminder_id` so quota checks are not executed twice.

Application clients cannot execute this producer function. They can only read
their own notifications and manage their own preferences.

## System producer coverage

System producers apply these recipient rules:

- a newly added workspace or project member receives the membership event;
- workspace removal is reported to the remaining owners and admins because the
  removed account immediately loses access and its workspace-private data is
  deleted;
- project removal is reported directly to the affected member while workspace
  access still exists;
- task assignment is delivered directly to the assignee;
- task creation, meaningful detail changes, status changes, and comments are
  broadcast to current project/task participants, excluding the actor;
- task position-only updates inside one status do not create notification noise;
- reminder recipients are controlled by the reminder's normalized recipient
  list; pre-insert channel filters apply the canonical global, event-specific,
  and plan gates without changing scheduler idempotency.

Every producer builds a stable occurrence key. Retrying an insert or processing
the same reminder occurrence therefore cannot duplicate its in-app or email
delivery. Payloads contain identifiers and application routes, never comment
bodies, email addresses, or credentials.

## GraphQL API

Authenticated clients can use:

- `unreadNotificationCount` for an exact count scoped to the verified current
  user without accepting a client-supplied user identifier;
- `notificationEventTypes` for active catalog metadata;
- `notificationEventPreferences` for the current user's explicit overrides;
- `notificationPlanEvents(workspaceId:)` for the workspace's effective plan
  capabilities;
- `updateNotificationEventPreference(input:)` to upsert one override;
- `deleteNotificationEventPreference(eventType:)` to remove an override and
  inherit catalog defaults again.

The existing `notificationPreferences` query and mutation continue to manage
global channel switches and the legacy task/reminder switches.

Custom schedule clients use `scheduledNotifications`,
`scheduledNotification`, `createScheduledNotification`,
`updateScheduledNotification`, `pauseScheduledNotification`,
`resumeScheduledNotification`, and `deleteScheduledNotification`. A schedule
belongs to its creator, requires workspace context, and may additionally point
to an accessible project and task. The API accepts one-time schedules or a
custom value/unit interval with an IANA timezone.

The notification center presents inbox, schedule, preference, and email
delivery views. It combines catalog defaults, explicit user overrides, and
workspace-plan entitlements so unavailable channels are visible but disabled.
Custom schedules currently notify only their creator. The recipient control
states this explicitly; team recipients require a future normalized recipient
model and authorization rules rather than a frontend-only selector.

Inbox navigation treats the JSON payload as untrusted input. Only exact
workspace, project, and task-detail route shapes are accepted, and every route
identifier must match the notification's structured context fields. Absolute,
protocol-relative, JavaScript, unknown, malformed, and context-mismatched routes
are rejected. The client then derives a destination from the deepest valid
structured context: task, project, then workspace. A notification without any
valid destination exposes an explicit `Mark as read` action instead.

The native client applies a stricter platform-specific rule: it does not query
or inspect `payload.route` at all. It validates the structured workspace,
project, and task identifiers, considers the dotted event type, and constructs
its own Expo Router destination. This prevents a web path or external payload
value from becoming a native deep link.

Opening an unread entry first applies an optimistic read state and calls
`markNotificationAsRead`; an already-read entry navigates without repeating the
mutation. The mutation derives the recipient from the authenticated session and
updates only a row whose notification ID and user ID both match. Recipient-only
RLS provides an independent database boundary.

The authenticated navigation displays the exact unread count beside
Notifications. Zero is hidden, values from 1 through 99 are shown directly, and
larger values are presented visually as `99+` while assistive technology receives
the complete count. Marking an item as read decrements the Apollo cached count
optimistically. A failed mutation rolls back the optimistic layer and refetches
the authoritative count from the API.

Until notification subscriptions are available, the navigation count is
polled every 60 seconds while the browser is online and its tab is visible.
Polling stops for hidden tabs, and the count query is skipped completely while
the browser is offline. Returning to a visible tab triggers an immediate
refetch. The polling query, visibility refresh, and mark-as-read cache update
all write the same exact-count cache entry. A future GraphQL notification
subscription can replace polling without changing the badge component.

## Custom schedule execution

`process_due_scheduled_notifications` claims a bounded due batch with `FOR
UPDATE SKIP LOCKED`. Each row produces a stable event key from the schedule ID
and due timestamp, then calls `create_notification_event` with the schedule's
requested channel mask. The producer rechecks current preferences and plan
entitlements at execution time.

One-time schedules become `completed`. Minute/hour recurrences use elapsed time
so a UTC offset change neither duplicates nor removes an interval. Day, week,
month, and year recurrences retain their original local calendar anchor and
wall-clock time across DST. Month/year occurrences clamp to the target month's
final day without permanent date drift. After downtime, one due occurrence is
produced and the schedule advances directly to the first future occurrence
instead of replaying every missed interval.

`notificationDeliveries` lists only rows addressed to the authenticated user.
It provides pending, processing, delivered, failed, and canceled status with
attempt counts and sanitized failure information for support and retry
visibility.

## Delivery boundary

`notification_deliveries` is a durable email outbox. The service-role worker:

1. claims a bounded due batch with `FOR UPDATE SKIP LOCKED`;
2. assigns each attempt a five-minute lease token;
3. renders escaped text and HTML email;
4. sends through the shared Nodemailer SMTP transport;
5. records success or failure through token-protected RPCs;
6. retries transient failures with bounded exponential backoff.

Permanent SMTP errors and deliveries that exhaust `max_attempts` remain failed
for operational inspection. `notification_delivery_attempts` preserves the
result of every completed worker attempt without storing credentials or full
SMTP responses. Logs contain only aggregate batch counts and errors, never
recipient addresses or message payloads.

Preference changes also apply to queued work. Disabling global email, a legacy
task/reminder switch, or an event-specific email channel cancels matching
pending and retryable failed deliveries. Terminal failures remain immutable
operational history. Every claim revalidates current preferences and plan
entitlements, so a downgrade or missed trigger path cannot send an email that
is no longer eligible. In-flight SMTP delivery cannot be recalled, while an
ineligible stale lease is canceled rather than reclaimed.

The delivery model is at-least-once. A stable SMTP `Message-ID`, database
idempotency key, and lease token prevent ordinary duplicates. SMTP itself
cannot provide an absolute exactly-once guarantee if the provider accepts a
message immediately before the database becomes unavailable.

Production metrics, alert thresholds, and recovery steps are documented in
[Notification operations](NOTIFICATION_OPERATIONS.md).

## Expo push channel

`user_devices` stores one active Expo token per physical installation and user.
Tokens are registered and revoked through authenticated GraphQL operations;
clients cannot list or change another user's devices. Global, event-specific,
and plan preferences independently gate the push channel.

Eligible canonical notification events create one idempotent push outbox row
per active device. The API worker atomically claims rows with `FOR UPDATE SKIP
LOCKED`, submits structured messages to Expo, stores push ticket IDs, and later
checks receipts. Transient provider and network failures use bounded retry
backoff. A `DeviceNotRegistered` receipt revokes the token and cancels its
remaining queued deliveries. Delivery history uses the same recipient-scoped
GraphQL view as email while immutable attempts identify `expo` as the provider.

Set `PUSH_NOTIFICATION_WORKER_ENABLED=true` only after migration 420 is applied.
Railway also requires `SUPABASE_SERVICE_ROLE_KEY`; `EXPO_ACCESS_TOKEN` is needed
only when enhanced push security is enabled in Expo. Logs must never contain
push tokens or complete provider payloads.
