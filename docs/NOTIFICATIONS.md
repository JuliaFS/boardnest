# Notification system

## Current scope

The notification event model provides one canonical vocabulary for workspace,
project, task, comment, reminder, and future custom-notification events. It also
centralizes channel selection, plan entitlements, user preferences,
idempotency, and email-outbox creation.

Canonical events queue email work in `notification_deliveries`. The API-hosted
delivery worker claims due rows and sends them through Nodemailer SMTP.
Invitation email remains a separate synchronous flow. Custom schedules and the
notification settings UI are later stages.

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
