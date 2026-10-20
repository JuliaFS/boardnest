import { describe, expect, it } from 'vitest';

import {
  notificationMutationMessage,
  notificationRoute,
  scheduledNotificationFormSchema,
} from './notification-schemas';

const validValues = {
  body: '',
  emailEnabled: false,
  endsAt: '',
  inAppEnabled: true,
  intervalUnit: 'WEEK' as const,
  intervalValue: 1,
  nextRunAt: '2030-01-15T10:00',
  projectId: '',
  scheduleKind: 'INTERVAL' as const,
  taskId: '',
  timezone: 'Europe/Sofia',
  title: 'Review release report',
};

describe('scheduled notification validation', () => {
  it('accepts a valid personal recurring notification', () => {
    expect(scheduledNotificationFormSchema.safeParse(validValues).success).toBe(
      true,
    );
  });

  it('requires at least one channel and a project for task context', () => {
    const result = scheduledNotificationFormSchema.safeParse({
      ...validValues,
      emailEnabled: false,
      inAppEnabled: false,
      taskId: 'task-id',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map(({ message }) => message)).toEqual(
        expect.arrayContaining([
          'Enable at least one delivery channel.',
          'Select a project before selecting a task.',
        ]),
      );
    }
  });

  it('turns plan failures into actionable messages', () => {
    expect(
      notificationMutationMessage(
        new Error(
          'Plan limit reached: 10 active custom notification schedule(s) per user and workspace.',
        ),
      ),
    ).toContain('Pause or delete a schedule');
  });
});

describe('notification route parsing', () => {
  it('accepts an application-relative route', () => {
    expect(
      notificationRoute({ route: '/projects/project-id/tasks/task-id' }),
    ).toBe('/projects/project-id/tasks/task-id');
  });

  it.each([
    null,
    {},
    { route: 'https://example.com' },
    { route: '//example.com' },
    { route: '/\\example.com' },
  ])('rejects a missing or non-local route: %j', (payload) => {
    expect(notificationRoute(payload)).toBeNull();
  });
});
