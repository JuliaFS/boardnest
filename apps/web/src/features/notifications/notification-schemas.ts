import { z } from 'zod';

export const scheduledNotificationFormSchema = z
  .object({
    body: z.string().max(2000, 'Use at most 2,000 characters.'),
    emailEnabled: z.boolean(),
    endsAt: z.string(),
    inAppEnabled: z.boolean(),
    intervalUnit: z.enum(['DAY', 'HOUR', 'MINUTE', 'MONTH', 'WEEK', 'YEAR']),
    intervalValue: z.number().int().min(1).max(1000),
    nextRunAt: z.string().min(1, 'Choose the first delivery time.'),
    projectId: z.string(),
    scheduleKind: z.enum(['INTERVAL', 'ONCE']),
    taskId: z.string(),
    timezone: z.string().trim().min(1, 'Enter an IANA timezone.').max(100),
    title: z.string().trim().min(1, 'Enter a title.').max(160),
  })
  .superRefine((values, context) => {
    if (!values.inAppEnabled && !values.emailEnabled) {
      context.addIssue({
        code: 'custom',
        message: 'Enable at least one delivery channel.',
        path: ['inAppEnabled'],
      });
    }
    if (values.taskId && !values.projectId) {
      context.addIssue({
        code: 'custom',
        message: 'Select a project before selecting a task.',
        path: ['projectId'],
      });
    }
    if (
      values.endsAt &&
      new Date(values.endsAt).getTime() <= new Date(values.nextRunAt).getTime()
    ) {
      context.addIssue({
        code: 'custom',
        message: 'The end time must be after the first delivery.',
        path: ['endsAt'],
      });
    }
  });

export type ScheduledNotificationFormValues = z.infer<
  typeof scheduledNotificationFormSchema
>;

export function toDateTimeLocal(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function toIsoDate(value: string): string {
  return new Date(value).toISOString();
}

export function notificationMutationMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('Plan limit reached:')) {
    return 'Your current plan has reached its active custom notification limit. Pause or delete a schedule, or upgrade the workspace plan.';
  }
  if (message.includes('requires a custom notification interval')) {
    return `${message} Choose a longer interval or upgrade the workspace plan.`;
  }
  if (message.includes('Email custom notifications are disabled')) {
    return 'Email delivery is disabled by your preferences or workspace plan. Enable it in Preferences or use in-app delivery.';
  }
  if (message.includes('In-app custom notifications are disabled')) {
    return 'In-app delivery is disabled by your preferences or workspace plan. Enable it in Preferences or use email delivery.';
  }
  if (message.includes('permission')) {
    return 'You no longer have access to the selected workspace, project, or task.';
  }
  return message || 'The notification could not be saved. Please try again.';
}

const uuidPattern =
  '[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const workspaceRoutePattern = new RegExp(`^/workspaces/(${uuidPattern})$`, 'i');
const projectRoutePattern = new RegExp(`^/projects/(${uuidPattern})$`, 'i');
const taskRoutePattern = new RegExp(
  `^/projects/(${uuidPattern})/tasks/(${uuidPattern})$`,
  'i',
);

const notificationRouteContextSchema = z.object({
  payload: z.unknown(),
  type: z.string().optional(),
  projectId: z.uuid().nullable(),
  taskId: z.uuid().nullable(),
  workspaceId: z.uuid(),
});

export interface NotificationRouteContext {
  payload: unknown;
  projectId: string | null;
  taskId: string | null;
  workspaceId: string;
}

export function notificationRoute(context: unknown): string | null {
  const parsedContext = notificationRouteContextSchema.safeParse(context);
  if (!parsedContext.success) return null;

  const { payload, projectId, taskId, workspaceId, type } = parsedContext.data;
  if (type === 'workspace.invited') {
    const invitation = z.object({ invitationId: z.uuid() }).safeParse(payload);
    return invitation.success
      ? `/invite/${invitation.data.invitationId}`
      : null;
  }
  const payloadRoute = extractPayloadRoute(payload);
  if (
    payloadRoute &&
    routeMatchesContext(payloadRoute, { projectId, taskId, workspaceId })
  ) {
    return payloadRoute;
  }

  if (projectId && taskId) {
    return `/projects/${projectId}/tasks/${taskId}`;
  }
  if (projectId) return `/projects/${projectId}`;
  return `/workspaces/${workspaceId}`;
}

function extractPayloadRoute(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return null;
  }

  const route = (payload as Record<string, unknown>).route;
  if (typeof route !== 'string') return null;

  const normalizedRoute = route.trim();
  if (normalizedRoute.length > 500) return null;

  return workspaceRoutePattern.test(normalizedRoute) ||
    projectRoutePattern.test(normalizedRoute) ||
    taskRoutePattern.test(normalizedRoute)
    ? normalizedRoute
    : null;
}

function routeMatchesContext(
  route: string,
  context: Omit<NotificationRouteContext, 'payload'>,
): boolean {
  const taskMatch = taskRoutePattern.exec(route);
  if (taskMatch) {
    return (
      equalId(taskMatch[1], context.projectId) &&
      equalId(taskMatch[2], context.taskId)
    );
  }

  const projectMatch = projectRoutePattern.exec(route);
  if (projectMatch) return equalId(projectMatch[1], context.projectId);

  const workspaceMatch = workspaceRoutePattern.exec(route);
  return workspaceMatch
    ? equalId(workspaceMatch[1], context.workspaceId)
    : false;
}

function equalId(routeId: string | undefined, contextId: string | null) {
  return routeId?.toLowerCase() === contextId?.toLowerCase();
}
