import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBoardnestDataService } from './data-service.js';

const supabase = vi.hoisted(() => {
  const builder = {
    delete: vi.fn(),
    eq: vi.fn(),
    insert: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
    range: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
    update: vi.fn(),
  };
  return {
    builder,
    from: vi.fn(),
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: supabase.from }),
}));

const userId = '4ac60f36-9f7a-419f-b447-d8f9d2bc7cd8';
const notificationId = '0f389807-6904-4d2f-bd26-4fc122ccdca8';
const workspaceId = 'f6629144-bb05-4a13-9950-99fc87a3ec25';
const notification = {
  actor_id: null,
  body: 'A task changed status.',
  created_at: '2026-10-20T09:00:00.000Z',
  event_key: 'task-status:example',
  id: notificationId,
  payload: { route: '/projects/example' },
  project_id: null,
  read_at: null,
  reminder_id: null,
  scheduled_for: null,
  task_id: null,
  title: 'Task updated',
  type: 'task.updated',
  user_id: userId,
  workspace_id: workspaceId,
};

describe('Boardnest data service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    supabase.from.mockReturnValue(supabase.builder);
    supabase.builder.select.mockReturnValue(supabase.builder);
    supabase.builder.eq.mockReturnValue(supabase.builder);
    supabase.builder.delete.mockReturnValue(supabase.builder);
    supabase.builder.insert.mockReturnValue(supabase.builder);
    supabase.builder.order.mockReturnValue(supabase.builder);
    supabase.builder.update.mockReturnValue(supabase.builder);
  });

  it('returns a clear conflict when a workspace slug already exists', async () => {
    supabase.builder.single.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'duplicate key' },
    });
    const service = createBoardnestDataService(
      'https://example.supabase.co',
      'publishable-key',
      'access-token',
    );

    await expect(
      service.updateWorkspace(workspaceId, { slug: 'existing-team' }),
    ).rejects.toThrow(
      'This workspace URL slug already exists. Choose a unique slug by adding a word or number.',
    );

    expect(supabase.builder.update).toHaveBeenCalledWith({
      slug: 'existing-team',
    });
    expect(supabase.builder.eq).toHaveBeenCalledWith('id', workspaceId);
  });

  it('performs an exact head-only unread count for one user', async () => {
    supabase.builder.is.mockResolvedValue({
      count: 4,
      data: null,
      error: null,
    });
    const service = createBoardnestDataService(
      'https://example.supabase.co',
      'publishable-key',
      'access-token',
    );

    await expect(service.unreadNotificationCount(userId)).resolves.toBe(4);

    expect(supabase.from).toHaveBeenCalledWith('notifications');
    expect(supabase.builder.select).toHaveBeenCalledWith('id', {
      count: 'exact',
      head: true,
    });
    expect(supabase.builder.eq).toHaveBeenCalledWith('user_id', userId);
    expect(supabase.builder.is).toHaveBeenCalledWith('read_at', null);
  });

  it('returns a sanitized error when the unread count fails', async () => {
    supabase.builder.is.mockResolvedValue({
      count: null,
      data: null,
      error: { message: 'Count failed' },
    });
    const service = createBoardnestDataService(
      'https://example.supabase.co',
      'publishable-key',
      'access-token',
    );

    await expect(service.unreadNotificationCount(userId)).rejects.toThrow(
      'The database operation failed.',
    );
  });

  it('lists only unread notifications with pagination metadata', async () => {
    supabase.builder.is.mockReturnValue(supabase.builder);
    supabase.builder.range.mockResolvedValue({
      data: [notification, { ...notification, id: crypto.randomUUID() }],
      error: null,
    });
    const service = createBoardnestDataService(
      'https://example.supabase.co',
      'publishable-key',
      'access-token',
    );

    await expect(
      service.notifications(userId, true, { limit: 1, offset: 5 }),
    ).resolves.toEqual({
      nodes: [notification],
      pageInfo: { hasNextPage: true, limit: 1, offset: 5 },
    });

    expect(supabase.builder.is).toHaveBeenCalledWith('read_at', null);
    expect(supabase.builder.order).toHaveBeenCalledWith('created_at', {
      ascending: false,
    });
    expect(supabase.builder.range).toHaveBeenCalledWith(5, 6);
  });

  it('lists read and unread notifications without applying an unread filter', async () => {
    supabase.builder.range.mockResolvedValue({
      data: [notification],
      error: null,
    });
    const service = createBoardnestDataService(
      'https://example.supabase.co',
      'publishable-key',
      'access-token',
    );

    await expect(
      service.notifications(userId, false, { limit: 25, offset: 0 }),
    ).resolves.toMatchObject({
      nodes: [notification],
      pageInfo: { hasNextPage: false },
    });

    expect(supabase.builder.is).not.toHaveBeenCalled();
  });

  it('returns a notification detail or null when it does not exist', async () => {
    supabase.builder.maybeSingle
      .mockResolvedValueOnce({ data: notification, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    const service = createBoardnestDataService(
      'https://example.supabase.co',
      'publishable-key',
      'access-token',
    );

    await expect(service.notification(notificationId)).resolves.toEqual(
      notification,
    );
    await expect(service.notification(notificationId)).resolves.toBeNull();

    expect(supabase.builder.eq).toHaveBeenCalledWith('id', notificationId);
  });

  it('marks a notification as read and returns the updated record', async () => {
    const readAt = '2026-10-20T10:00:00.000Z';
    const updatedNotification = {
      ...notification,
      read_at: readAt,
    };
    supabase.builder.single.mockResolvedValue({
      data: updatedNotification,
      error: null,
    });
    const service = createBoardnestDataService(
      'https://example.supabase.co',
      'publishable-key',
      'access-token',
    );

    vi.useFakeTimers();
    vi.setSystemTime(new Date(readAt));
    try {
      await expect(
        service.markNotificationAsRead(notificationId, userId),
      ).resolves.toEqual(updatedNotification);

      expect(supabase.builder.update).toHaveBeenCalledWith({ read_at: readAt });
      expect(supabase.builder.eq).toHaveBeenCalledWith('id', notificationId);
      expect(supabase.builder.eq).toHaveBeenCalledWith('user_id', userId);
      expect(supabase.builder.select).toHaveBeenCalledWith('*');
    } finally {
      vi.useRealTimers();
    }
  });

  it('scopes notification read updates to the authenticated recipient', async () => {
    supabase.builder.single.mockResolvedValue({
      data: null,
      error: { message: 'No rows found' },
    });
    const service = createBoardnestDataService(
      'https://example.supabase.co',
      'publishable-key',
      'access-token',
    );

    await expect(
      service.markNotificationAsRead(notificationId, userId),
    ).rejects.toThrow('The database operation failed.');

    expect(supabase.builder.eq).toHaveBeenNthCalledWith(
      1,
      'id',
      notificationId,
    );
    expect(supabase.builder.eq).toHaveBeenNthCalledWith(2, 'user_id', userId);
  });

  it('updates and moves tasks through the expected database operations', async () => {
    const task = {
      archived_at: null,
      created_at: '2026-10-20T09:00:00.000Z',
      created_by: userId,
      description: null,
      due_at: null,
      id: '6db362d7-bfe5-42aa-8d2d-b98513628f9f',
      position: 1000,
      priority: 'MEDIUM',
      project_id: '254f67ae-fbfa-4bee-bd4b-b224b7c9fada',
      status_id: '16187a45-894f-4fcc-8d84-d1c4dd45346b',
      title: 'Prepare release',
      updated_at: '2026-10-20T10:00:00.000Z',
    };
    supabase.builder.single.mockResolvedValue({ data: task, error: null });
    const service = createBoardnestDataService(
      'https://example.supabase.co',
      'publishable-key',
      'access-token',
    );

    await expect(
      service.updateTask(task.id, { priority: 'MEDIUM', title: task.title }),
    ).resolves.toEqual(task);
    await expect(
      service.moveTask(task.id, task.status_id, task.position),
    ).resolves.toEqual(task);

    expect(supabase.builder.update).toHaveBeenCalledWith({
      priority: 'MEDIUM',
      title: task.title,
    });
    expect(supabase.builder.update).toHaveBeenCalledWith({
      position: task.position,
      status_id: task.status_id,
    });
  });

  it('deletes a task and returns its validated identifier', async () => {
    supabase.builder.single.mockResolvedValue({
      data: { id: notificationId },
      error: null,
    });
    const service = createBoardnestDataService(
      'https://example.supabase.co',
      'publishable-key',
      'access-token',
    );

    await expect(service.deleteTask(notificationId)).resolves.toBe(
      notificationId,
    );

    expect(supabase.builder.delete).toHaveBeenCalledOnce();
    expect(supabase.builder.select).toHaveBeenCalledWith('id');
  });

  it('assigns a user to a task and creates a task comment', async () => {
    const taskId = '6db362d7-bfe5-42aa-8d2d-b98513628f9f';
    const assigneeId = '2df85234-1a26-42b6-b10f-622e89d6e7ca';
    const assignment = {
      assigned_at: '2026-10-20T10:00:00.000Z',
      assigned_by: userId,
      task_id: taskId,
      user_id: assigneeId,
    };
    const comment = {
      author_id: userId,
      body: 'Ready for review.',
      created_at: '2026-10-20T10:05:00.000Z',
      edited_at: null,
      id: '3654dd85-b0a9-495b-842e-405f48257ef6',
      task_id: taskId,
      updated_at: '2026-10-20T10:05:00.000Z',
    };
    supabase.builder.single
      .mockResolvedValueOnce({ data: assignment, error: null })
      .mockResolvedValueOnce({ data: comment, error: null });
    const service = createBoardnestDataService(
      'https://example.supabase.co',
      'publishable-key',
      'access-token',
    );

    await expect(
      service.assignTask(taskId, assigneeId, userId),
    ).resolves.toEqual(assignment);
    await expect(
      service.addComment(taskId, comment.body, userId),
    ).resolves.toEqual(comment);

    expect(supabase.builder.insert).toHaveBeenCalledWith({
      assigned_by: userId,
      task_id: taskId,
      user_id: assigneeId,
    });
    expect(supabase.builder.insert).toHaveBeenCalledWith({
      author_id: userId,
      body: comment.body,
      task_id: taskId,
    });
  });

  it('removes a task assignment by its composite identifier', async () => {
    const taskId = '6db362d7-bfe5-42aa-8d2d-b98513628f9f';
    const assigneeId = '2df85234-1a26-42b6-b10f-622e89d6e7ca';
    supabase.builder.single.mockResolvedValue({
      data: { user_id: assigneeId },
      error: null,
    });
    const service = createBoardnestDataService(
      'https://example.supabase.co',
      'publishable-key',
      'access-token',
    );

    await expect(service.unassignTask(taskId, assigneeId)).resolves.toBe(
      assigneeId,
    );

    expect(supabase.builder.delete).toHaveBeenCalledOnce();
    expect(supabase.builder.eq).toHaveBeenCalledWith('task_id', taskId);
    expect(supabase.builder.eq).toHaveBeenCalledWith('user_id', assigneeId);
    expect(supabase.builder.select).toHaveBeenCalledWith('user_id');
  });

  it('returns a project-filtered activity feed with pagination', async () => {
    const projectId = '254f67ae-fbfa-4bee-bd4b-b224b7c9fada';
    const activity = {
      actor_id: userId,
      created_at: '2026-10-20T11:00:00.000Z',
      entity_id: notificationId,
      entity_type: 'notification',
      event_type: 'notification.read',
      id: '2f05ee4c-fc7d-4783-903b-0da92aec3292',
      metadata: {},
      project_id: projectId,
      task_id: null,
      workspace_id: workspaceId,
    };
    supabase.builder.range.mockResolvedValue({
      data: [activity],
      error: null,
    });
    const service = createBoardnestDataService(
      'https://example.supabase.co',
      'publishable-key',
      'access-token',
    );

    await expect(
      service.activityFeed(workspaceId, projectId, { limit: 10, offset: 0 }),
    ).resolves.toEqual({
      nodes: [activity],
      pageInfo: { hasNextPage: false, limit: 10, offset: 0 },
    });

    expect(supabase.builder.eq).toHaveBeenCalledWith(
      'workspace_id',
      workspaceId,
    );
    expect(supabase.builder.eq).toHaveBeenCalledWith('project_id', projectId);
  });

  it('returns null when a requested task does not exist', async () => {
    supabase.builder.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    const service = createBoardnestDataService(
      'https://example.supabase.co',
      'publishable-key',
      'access-token',
    );

    await expect(service.task(notificationId)).resolves.toBeNull();

    expect(supabase.from).toHaveBeenCalledWith('tasks');
    expect(supabase.builder.eq).toHaveBeenCalledWith('id', notificationId);
  });

  it('returns ordered task statuses for a project', async () => {
    const projectId = '254f67ae-fbfa-4bee-bd4b-b224b7c9fada';
    const status = {
      category: 'TODO',
      color: '#64748b',
      created_at: '2026-10-20T09:00:00.000Z',
      id: '16187a45-894f-4fcc-8d84-d1c4dd45346b',
      name: 'To do',
      position: 1000,
      project_id: projectId,
      updated_at: '2026-10-20T09:00:00.000Z',
    };
    supabase.builder.order.mockResolvedValue({
      data: [status],
      error: null,
    });
    const service = createBoardnestDataService(
      'https://example.supabase.co',
      'publishable-key',
      'access-token',
    );

    await expect(service.taskStatuses(projectId)).resolves.toEqual([status]);

    expect(supabase.from).toHaveBeenCalledWith('task_statuses');
    expect(supabase.builder.eq).toHaveBeenCalledWith('project_id', projectId);
    expect(supabase.builder.order).toHaveBeenCalledWith('position', {
      ascending: true,
    });
  });
});
