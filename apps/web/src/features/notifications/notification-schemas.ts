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
