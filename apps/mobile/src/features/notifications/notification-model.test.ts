import { describe, expect, it } from 'vitest';

import {
  mobileNotificationRoute,
  unreadBadgeLabel,
  validateScheduleForm,
  type ScheduleFormValues,
} from './notification-model';

const workspaceId = '35b70c1e-4b55-4a16-b85b-29c2fe513701';
const projectId = 'f234f172-53cd-410b-a81d-e9cde593f8be';
const taskId = '096bbdda-7f50-41bd-82df-3e774800f6c7';

describe('mobile notification routes', () => {
  it('builds native routes from structured identifiers', () => {
    expect(
      mobileNotificationRoute({
        projectId,
        taskId,
        type: 'task.updated',
        workspaceId,
      }),
    ).toBe(`/projects/${projectId}/tasks/${taskId}`);
    expect(
      mobileNotificationRoute({
        projectId,
        type: 'project.member_added',
        workspaceId,
      }),
    ).toBe(`/projects/${projectId}`);
    expect(
      mobileNotificationRoute({ type: 'workspace.member_added', workspaceId }),
    ).toBe(`/workspaces/${workspaceId}`);
    expect(
      mobileNotificationRoute({
        projectId,
        taskId,
        type: 'project.member_added',
        workspaceId,
      }),
    ).toBe(`/projects/${projectId}`);
  });

  it('rejects missing or invalid structured identifiers', () => {
    expect(
      mobileNotificationRoute({
        type: 'task.updated',
        workspaceId: 'javascript:alert(1)',
      }),
    ).toBeNull();
  });
});

describe('notification presentation', () => {
  it.each([
    [0, undefined],
    [5, '5'],
    [99, '99'],
    [100, '99+'],
  ])('formats unread badge count %i', (count, expected) => {
    expect(unreadBadgeLabel(count)).toBe(expected);
  });

  it('validates plan intervals and delivery channels', () => {
    const values: ScheduleFormValues = {
      body: '',
      emailEnabled: false,
      endsAt: '',
      inAppEnabled: false,
      intervalUnit: 'MINUTE',
      intervalValue: '15',
      nextRunAt: '2026-12-01T10:00:00.000Z',
      projectId: '',
      scheduleKind: 'INTERVAL',
      taskId: '',
      timezone: 'Europe/Sofia',
      title: 'Review the roadmap',
    };
    expect(validateScheduleForm(values, 60)).toEqual({
      channels: 'Enable at least one delivery channel.',
      intervalValue: 'Your plan requires an interval of at least 1 hour(s).',
    });
  });
});
