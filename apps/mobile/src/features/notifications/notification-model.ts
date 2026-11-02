import type { Href } from 'expo-router';

import { mobileRoutes } from '../../navigation/routes';

export type NotificationRouteContext = {
  projectId?: string | null;
  taskId?: string | null;
  type: string;
  workspaceId?: string | null;
};

export type ScheduleFormValues = {
  body: string;
  emailEnabled: boolean;
  endsAt: string;
  inAppEnabled: boolean;
  intervalUnit: 'DAY' | 'HOUR' | 'MINUTE' | 'MONTH' | 'WEEK' | 'YEAR';
  intervalValue: string;
  nextRunAt: string;
  projectId: string;
  scheduleKind: 'INTERVAL' | 'ONCE';
  taskId: string;
  timezone: string;
  title: string;
};

export type ScheduleFormErrors = Partial<
  Record<
    'channels' | 'endsAt' | 'intervalValue' | 'nextRunAt' | 'title',
    string
  >
>;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function mobileNotificationRoute(
  context: NotificationRouteContext,
): Href | null {
  if (!isUuid(context.workspaceId)) return null;
  const eventScope = context.type.split('.')[0]?.toLowerCase();
  if (eventScope === 'workspace') {
    return mobileRoutes.workspace(context.workspaceId);
  }
  if (eventScope === 'project' && isUuid(context.projectId)) {
    return mobileRoutes.project(context.projectId);
  }
  if (isUuid(context.projectId) && isUuid(context.taskId)) {
    return mobileRoutes.task(context.projectId, context.taskId);
  }
  if (isUuid(context.projectId)) return mobileRoutes.project(context.projectId);
  return mobileRoutes.workspace(context.workspaceId);
}

export function unreadBadgeLabel(count: number): string | undefined {
  if (count <= 0) return undefined;
  return count > 99 ? '99+' : String(count);
}

export function validateScheduleForm(
  values: ScheduleFormValues,
  minimumIntervalMinutes: number,
): ScheduleFormErrors {
  const errors: ScheduleFormErrors = {};
  if (!values.title.trim()) errors.title = 'Enter a title.';
  if (!isDate(values.nextRunAt)) {
    errors.nextRunAt = 'Enter a valid ISO date and time.';
  }
  if (values.endsAt && !isDate(values.endsAt)) {
    errors.endsAt = 'Enter a valid ISO date and time.';
  } else if (
    values.endsAt &&
    isDate(values.nextRunAt) &&
    new Date(values.endsAt).getTime() <= new Date(values.nextRunAt).getTime()
  ) {
    errors.endsAt = 'The end time must be after the first delivery.';
  }
  if (!values.inAppEnabled && !values.emailEnabled) {
    errors.channels = 'Enable at least one delivery channel.';
  }
  if (values.scheduleKind === 'INTERVAL') {
    const intervalValue = Number(values.intervalValue);
    if (
      !Number.isInteger(intervalValue) ||
      intervalValue < 1 ||
      intervalValue * intervalMinutes[values.intervalUnit] <
        minimumIntervalMinutes
    ) {
      errors.intervalValue = `Your plan requires an interval of at least ${formatMinutes(minimumIntervalMinutes)}.`;
    }
  }
  return errors;
}

export function notificationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('Plan limit reached:')) {
    return 'Your plan has reached its active custom notification limit. Pause or delete a schedule, or upgrade the workspace plan.';
  }
  if (message.includes('requires a custom notification interval')) {
    return `${message} Choose a longer interval or upgrade the workspace plan.`;
  }
  if (message.includes('Email custom notifications are disabled')) {
    return 'Email delivery is disabled by your preferences or workspace plan.';
  }
  if (message.includes('permission')) {
    return 'You no longer have access to the selected notification context.';
  }
  return message || 'The notification action could not be completed.';
}

function isDate(value: string): boolean {
  return value.trim().length > 0 && !Number.isNaN(new Date(value).getTime());
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && uuidPattern.test(value);
}

const intervalMinutes = {
  DAY: 1_440,
  HOUR: 60,
  MINUTE: 1,
  MONTH: 43_200,
  WEEK: 10_080,
  YEAR: 525_600,
} as const;

function formatMinutes(minutes: number): string {
  if (minutes % 1_440 === 0) return `${minutes / 1_440} day(s)`;
  if (minutes % 60 === 0) return `${minutes / 60} hour(s)`;
  return `${minutes} minute(s)`;
}
