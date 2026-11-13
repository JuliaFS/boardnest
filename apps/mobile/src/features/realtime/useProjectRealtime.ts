import {
  MobileProjectMembershipChangedDocument,
  MobileTaskCommentChangedDocument,
  MobileTaskCreatedDocument,
  MobileTaskDeletedDocument,
  MobileTaskUpdatedDocument,
  type MobileTaskCreatedSubscription,
  type MobileTaskCommentChangedSubscription,
} from '@boardnest/graphql-types';
import { useSubscription } from '@apollo/client/react';
import { useEffect, useRef } from 'react';

import { createEventDeduplicator, taskEventKey } from '@/lib/realtime-events';

type RealtimeTask = MobileTaskCreatedSubscription['taskCreated'];

type ProjectRealtimeOptions = {
  commentTaskId?: string;
  onCommentChanged?: (
    event: MobileTaskCommentChangedSubscription['taskCommentChanged'],
  ) => void;
  onMembershipChanged?: () => void;
  onTaskCreated?: (task: RealtimeTask) => void;
  onTaskDeleted?: (taskId: string) => void;
  onTaskUpdated?: (task: RealtimeTask) => void;
  projectId: string;
  skip?: boolean;
};

export function useProjectRealtime({
  commentTaskId,
  onCommentChanged,
  onMembershipChanged,
  onTaskCreated,
  onTaskDeleted,
  onTaskUpdated,
  projectId,
  skip = false,
}: ProjectRealtimeOptions): void {
  const deduplicator = useRef(createEventDeduplicator());
  const baseSkip = skip || !projectId;
  const variables = { projectId };
  const created = useSubscription(MobileTaskCreatedDocument, {
    skip: baseSkip || !onTaskCreated,
    variables,
  });
  const updated = useSubscription(MobileTaskUpdatedDocument, {
    skip: baseSkip || !onTaskUpdated,
    variables,
  });
  const deleted = useSubscription(MobileTaskDeletedDocument, {
    skip: baseSkip || !onTaskDeleted,
    variables,
  });
  const comments = useSubscription(MobileTaskCommentChangedDocument, {
    skip: baseSkip || !onCommentChanged,
    variables,
  });
  const membership = useSubscription(MobileProjectMembershipChangedDocument, {
    skip: baseSkip || !onMembershipChanged,
    variables,
  });

  useEffect(() => {
    const task = created.data?.taskCreated;
    if (task && deduplicator.current.accept(taskEventKey('created', task))) {
      onTaskCreated?.(task);
    }
  }, [created.data, onTaskCreated]);

  useEffect(() => {
    const task = updated.data?.taskUpdated;
    if (task && deduplicator.current.accept(taskEventKey('updated', task))) {
      onTaskUpdated?.(task);
    }
  }, [onTaskUpdated, updated.data]);

  useEffect(() => {
    const taskId = deleted.data?.taskDeleted.id;
    if (
      taskId &&
      deduplicator.current.accept(taskEventKey('deleted', taskId))
    ) {
      onTaskDeleted?.(taskId);
    }
  }, [deleted.data, onTaskDeleted]);

  useEffect(() => {
    const event = comments.data?.taskCommentChanged;
    if (
      event &&
      (!commentTaskId || event.taskId === commentTaskId) &&
      deduplicator.current.accept(event.id)
    ) {
      onCommentChanged?.(event);
    }
  }, [commentTaskId, comments.data, onCommentChanged]);

  useEffect(() => {
    const event = membership.data?.projectMembershipChanged;
    if (event && deduplicator.current.accept(event.id)) {
      onMembershipChanged?.();
    }
  }, [membership.data, onMembershipChanged]);
}
