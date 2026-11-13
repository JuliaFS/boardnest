import {
  MobileTaskCommentChangedDocument,
  type MobileTaskCommentChangedSubscription,
} from '@boardnest/graphql-types';
import { useSubscription } from '@apollo/client/react';
import { renderHook } from '@testing-library/react-native';

import { useProjectRealtime } from './useProjectRealtime';

jest.mock('@apollo/client/react', () => ({ useSubscription: jest.fn() }));

describe('project comment subscriptions', () => {
  it('only delivers comments for the open task and deduplicates redelivery', async () => {
    let event: MobileTaskCommentChangedSubscription['taskCommentChanged'] = {
      id: 'event-other',
      kind: 'task_comment',
      occurredAt: '2026-11-13T00:00:00Z',
      projectId: 'project-1',
      workspaceId: null,
      taskId: 'other-task',
    };
    jest.mocked(useSubscription).mockImplementation((document) => ({
      data:
        document === MobileTaskCommentChangedDocument
          ? { taskCommentChanged: event }
          : undefined,
      loading: false,
      restart: jest.fn(),
    }));
    const onCommentChanged = jest.fn();
    const onMembershipChanged = jest.fn();
    const hook = await renderHook(() =>
      useProjectRealtime({
        projectId: 'project-1',
        commentTaskId: 'open-task',
        onCommentChanged,
        onMembershipChanged,
      }),
    );

    expect(onCommentChanged).not.toHaveBeenCalled();
    event = { ...event, id: 'event-open', taskId: 'open-task' };
    await hook.rerender({});
    expect(onCommentChanged).toHaveBeenCalledWith(event);
    await hook.rerender({});
    expect(onCommentChanged).toHaveBeenCalledTimes(1);
    expect(onMembershipChanged).not.toHaveBeenCalled();
    event = { ...event, id: 'event-null', taskId: null };
    await hook.rerender({});
    expect(onCommentChanged).toHaveBeenCalledTimes(1);
  });
});
