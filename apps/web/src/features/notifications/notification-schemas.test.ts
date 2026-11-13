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
  const workspaceId = '6992c303-a240-4e15-8fcc-461d53756324';
  const projectId = '7a1e63bf-715d-41c0-a81a-f86539d07d6e';
  const taskId = 'b75e3536-a899-42b8-b136-305446ddae69';

  it.each([
    `/workspaces/${workspaceId}`,
    `/projects/${projectId}`,
    `/projects/${projectId}/tasks/${taskId}`,
  ])('accepts the allowlisted route %s when its context matches', (route) => {
    expect(
      notificationRoute({
        payload: { route },
        projectId,
        taskId,
        workspaceId,
      }),
    ).toBe(route);
  });

  it.each([
    'https://example.com',
    '//example.com',
    'javascript:alert(1)',
    '/\\example.com',
    '/settings',
    `/projects/${projectId}/board`,
    `/projects/${projectId}?tab=members`,
  ])('rejects the non-allowlisted payload route %s', (route) => {
    expect(
      notificationRoute({
        payload: { route },
        projectId,
        taskId,
        workspaceId,
      }),
    ).toBe(`/projects/${projectId}/tasks/${taskId}`);
  });

  it('rejects a validly shaped route whose ID does not match the context', () => {
    expect(
      notificationRoute({
        payload: {
          route: '/projects/079f7571-a698-4d53-9613-156608b15aa9',
        },
        projectId,
        taskId: null,
        workspaceId,
      }),
    ).toBe(`/projects/${projectId}`);
  });

  it.each([
    {
      expected: `/projects/${projectId}/tasks/${taskId}`,
      projectId,
      taskId,
    },
    { expected: `/projects/${projectId}`, projectId, taskId: null },
    { expected: `/workspaces/${workspaceId}`, projectId: null, taskId: null },
  ])(
    'derives $expected when payload.route is missing',
    ({ expected, projectId: fallbackProjectId, taskId: fallbackTaskId }) => {
      expect(
        notificationRoute({
          payload: {},
          projectId: fallbackProjectId,
          taskId: fallbackTaskId,
          workspaceId,
        }),
      ).toBe(expected);
    },
  );

  it('returns no route when the structured context is invalid', () => {
    expect(
      notificationRoute({
        payload: { route: `/workspaces/${workspaceId}` },
        projectId: null,
        taskId: null,
        workspaceId: 'invalid-workspace-id',
      }),
    ).toBeNull();
  });
});

describe('invitation notification routes', () => {
  it('opens a validated invitation ID instead of the inaccessible workspace', () => {
    const id = '6992c303-a240-4e15-8fcc-461d53756324';
    const context = {
      type: 'workspace.invited',
      workspaceId: id,
      projectId: null,
      taskId: null,
    };
    expect(
      notificationRoute({ ...context, payload: { invitationId: id } }),
    ).toBe(`/invite/${id}`);
    expect(
      notificationRoute({
        ...context,
        payload: { invitationId: 'https://example.com' },
      }),
    ).toBeNull();
    expect(notificationRoute({ ...context, payload: {} })).toBeNull();
  });
});
