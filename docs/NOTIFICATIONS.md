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
authorized GraphQL CRUD API and a frontend for personal schedule management.
Executing their due occurrences remains a later scheduler stage.

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

The delivery model is at-least-once. A stable SMTP `Message-ID`, database
idempotency key, and lease token prevent ordinary duplicates. SMTP itself
cannot provide an absolute exactly-once guarantee if the provider accepts a
message immediately before the database becomes unavailable.
