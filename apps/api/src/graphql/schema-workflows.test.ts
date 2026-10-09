import { describe, expect, it, vi } from 'vitest';

import type { PublicAuthUser } from '../auth/auth-service.js';
import type { RealtimeEventBus, TaskEvent } from '../realtime/event-bus.js';
import type { BoardnestDataService } from './data-service.js';
import type {
  NotificationPreferences,
  Project,
  Task,
  TaskAssignee,
  TaskReminder,
} from './domain.js';
import { resolvers, type GraphQLContext } from './schema.js';

const user: PublicAuthUser = {
  displayName: 'Test User',
  email: 'person@example.com',
  id: '4ac60f36-9f7a-419f-b447-d8f9d2bc7cd8',
  isAnonymous: false,
  role: 'authenticated',
};
const workspaceId = '6992c303-a240-4e15-8fcc-461d53756324';
const projectId = 'f2410cb7-47f6-4af6-8ed9-f1d7a45158fc';
const taskId = 'ae248328-e9e4-4416-a92d-47af95406e4d';
const statusId = '6954de6d-ed8e-4409-8be8-9e0ce72ba8c4';
const nextStatusId = '67b31b8b-abbb-4134-b2d8-32984172c3ed';
const assigneeId = 'b6067e89-1702-49b6-92f7-d2f2ccbc4685';
const reminderId = '98fa7790-e43b-4e9e-a600-8f8a56fc9864';
const timestamp = new Date(0).toISOString();
const nextRunAt = '2030-01-15T08:00:00.000Z';

const project: Project = {
  archived_at: null,
  created_at: timestamp,
  created_by: user.id,
  description: 'Release plan',
  due_date: null,
  id: projectId,
  name: 'Launch',
  start_date: null,
  status: 'active',
  updated_at: timestamp,
  visibility: 'private',
  workspace_id: workspaceId,
};

const task: Task = {
  archived_at: null,
  created_at: timestamp,
  created_by: user.id,
  description: null,
  due_at: null,
  id: taskId,
  position: 1000,
  priority: 'medium',
  project_id: projectId,
  status_id: statusId,
  title: 'Prepare release',
  updated_at: timestamp,
};

const reminder: TaskReminder = {
  created_at: timestamp,
  created_by: user.id,
  email_enabled: true,
  ends_at: null,
  id: reminderId,
  in_app_enabled: true,
  last_run_at: null,
  next_run_at: nextRunAt,
  project_id: projectId,
  recipient_ids: [user.id, assigneeId],
  schedule_kind: 'weekly',
  status: 'active',
  stop_when_completed: true,
  task_id: taskId,
  timezone: 'Europe/Sofia',
  updated_at: timestamp,
  workspace_id: workspaceId,
};

const preferences: NotificationPreferences = {
  created_at: timestamp,
  email_enabled: true,
  in_app_enabled: true,
  reminder_enabled: true,
  task_assigned_enabled: true,
  task_created_enabled: true,
  updated_at: timestamp,
  user_id: user.id,
};

type MutationResolver = (
  parent: unknown,
  args: Record<string, unknown>,
  context: GraphQLContext,
) => unknown;

const mutations = resolvers.Mutation as unknown as Record<
  string,
  MutationResolver
>;
const queries = resolvers.Query as unknown as Record<string, MutationResolver>;

function createEvents() {
  return {
    close: vi.fn().mockResolvedValue(undefined),
    publishTask: vi.fn().mockResolvedValue(undefined),
    subscribeToTasks: vi.fn(),
  } satisfies RealtimeEventBus;
}

function createDataService(overrides: Partial<BoardnestDataService>) {
  return overrides as BoardnestDataService;
}

function context(
  data: BoardnestDataService | null,
  events = createEvents(),
  authenticatedUser: PublicAuthUser | null = user,
): GraphQLContext {
  return { data, events, user: authenticatedUser };
}

function runMutation(
  name: string,
  args: Record<string, unknown>,
  value: GraphQLContext,
) {
  const resolver = mutations[name];
  if (!resolver) throw new Error(`Unknown mutation resolver: ${name}`);
  return Promise.resolve(resolver(undefined, args, value));
}

function runQuery(
  name: string,
  args: Record<string, unknown>,
  value: GraphQLContext,
) {
  const resolver = queries[name];
  if (!resolver) throw new Error(`Unknown query resolver: ${name}`);
  return Promise.resolve(resolver(undefined, args, value));
}

describe('GraphQL project and task workflow resolvers', () => {
  it('accepts an invitation token through the authenticated data service', async () => {
    const token = 'a'.repeat(43);
    const membership = {
      joined_at: timestamp,
      role: 'member',
      updated_at: timestamp,
      user_id: user.id,
      workspace_id: workspaceId,
    };
    const acceptInvitation = vi.fn().mockResolvedValue(membership);

    await expect(
      runMutation(
        'acceptInvitation',
        { token },
        context(createDataService({ acceptInvitation })),
      ),
    ).resolves.toEqual(membership);
    expect(acceptInvitation).toHaveBeenCalledWith(token);
  });

  it('delivers a workspace invitation and hides the raw token after email success', async () => {
    const token = 'b'.repeat(43);
    const invitation = {
      accepted_at: null,
      accepted_by: null,
      created_at: timestamp,
      email: 'member@example.com',
      expires_at: new Date(Date.now() + 60_000).toISOString(),
      id: reminderId,
      invited_by: user.id,
      revoked_at: null,
      role: 'member',
      status: 'pending',
      updated_at: timestamp,
      workspace_id: workspaceId,
    };
    const inviteMember = vi.fn().mockResolvedValue({ invitation, token });
    const workspace = vi.fn().mockResolvedValue({
      id: workspaceId,
      name: 'Product team',
    });
    const sendWorkspaceInvitation = vi.fn().mockResolvedValue(undefined);
    const value = {
      ...context(createDataService({ inviteMember, workspace })),
      invitationEmail: { sendWorkspaceInvitation },
    };

    await expect(
      runMutation(
        'inviteMember',
        {
          input: {
            email: 'member@example.com',
            role: 'member',
            workspaceId,
          },
        },
        value,
      ),
    ).resolves.toMatchObject({ emailSent: true, invitation, token: null });
    expect(sendWorkspaceInvitation).toHaveBeenCalledWith({
      email: 'member@example.com',
      inviterName: user.displayName,
      token,
      workspaceName: 'Product team',
    });
  });

  it('lists members and invitations and validates workspace member management', async () => {
    const workspaceMembers = vi.fn().mockResolvedValue({ nodes: [] });
    const workspaceInvitations = vi.fn().mockResolvedValue({ nodes: [] });
    const updateWorkspaceMemberRole = vi.fn().mockResolvedValue({});
    const removeWorkspaceMember = vi.fn().mockResolvedValue(assigneeId);
    const revokeInvitation = vi.fn().mockResolvedValue({});
    const value = context(
      createDataService({
        removeWorkspaceMember,
        revokeInvitation,
        updateWorkspaceMemberRole,
        workspaceInvitations,
        workspaceMembers,
      }),
    );

    await runQuery('workspaceMembers', { workspaceId }, value);
    await runQuery('workspaceInvitations', { workspaceId }, value);
    await runMutation(
      'updateWorkspaceMemberRole',
      { role: 'viewer', userId: assigneeId, workspaceId },
      value,
    );
    await expect(
      runMutation(
        'updateWorkspaceMemberRole',
        { role: 'owner', userId: assigneeId, workspaceId },
        value,
      ),
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
    await runMutation(
      'removeWorkspaceMember',
      { userId: assigneeId, workspaceId },
      value,
    );
    await runMutation('revokeInvitation', { id: reminderId }, value);

    expect(workspaceMembers).toHaveBeenCalledWith(workspaceId, {
      limit: 25,
      offset: 0,
    });
    expect(workspaceInvitations).toHaveBeenCalledWith(workspaceId, {
      limit: 25,
      offset: 0,
    });
    expect(updateWorkspaceMemberRole).toHaveBeenCalledOnce();
    expect(updateWorkspaceMemberRole).toHaveBeenCalledWith(
      workspaceId,
      assigneeId,
      'viewer',
    );
    expect(removeWorkspaceMember).toHaveBeenCalledWith(workspaceId, assigneeId);
    expect(revokeInvitation).toHaveBeenCalledWith(reminderId);
  });

  it('lists and manages project members with validated roles', async () => {
    const projectMembers = vi.fn().mockResolvedValue({ nodes: [] });
    const addProjectMember = vi.fn().mockResolvedValue({});
    const updateProjectMemberRole = vi.fn().mockResolvedValue({});
    const removeProjectMember = vi.fn().mockResolvedValue(assigneeId);
    const value = context(
      createDataService({
        addProjectMember,
        projectMembers,
        removeProjectMember,
        updateProjectMemberRole,
      }),
    );

    await runQuery('projectMembers', { projectId }, value);
    await runMutation(
      'addProjectMember',
      { projectId, role: 'member', userId: assigneeId },
      value,
    );
    await runMutation(
      'updateProjectMemberRole',
      { projectId, role: 'project_lead', userId: assigneeId },
      value,
    );
    await expect(
      runMutation(
        'updateProjectMemberRole',
        { projectId, role: 'owner', userId: assigneeId },
        value,
      ),
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
    await runMutation(
      'removeProjectMember',
      { projectId, userId: assigneeId },
      value,
    );

    expect(projectMembers).toHaveBeenCalledWith(projectId, {
      limit: 25,
      offset: 0,
    });
    expect(addProjectMember).toHaveBeenCalledWith(
      projectId,
      assigneeId,
      'member',
    );
    expect(updateProjectMemberRole).toHaveBeenCalledOnce();
    expect(updateProjectMemberRole).toHaveBeenCalledWith(
      projectId,
      assigneeId,
      'project_lead',
    );
    expect(removeProjectMember).toHaveBeenCalledWith(projectId, assigneeId);
  });

  it('creates a private project with normalized input and the authenticated creator', async () => {
    const createProject = vi.fn().mockResolvedValue(project);

    await expect(
      runMutation(
        'createProject',
        {
          input: {
            name: '  Launch  ',
            visibility: 'private',
            workspaceId,
          },
        },
        context(createDataService({ createProject })),
      ),
    ).resolves.toEqual(project);
    expect(createProject).toHaveBeenCalledWith(
      {
        name: 'Launch',
        status: 'active',
        visibility: 'private',
        workspace_id: workspaceId,
      },
      user.id,
    );
  });

  it('creates and edits a task and publishes matching real-time events', async () => {
    const updatedTask: Task = {
      ...task,
      priority: 'high',
      title: 'Prepare production release',
    };
    const createTask = vi.fn().mockResolvedValue(task);
    const updateTask = vi.fn().mockResolvedValue(updatedTask);
    const events = createEvents();
    const value = context(
      createDataService({ createTask, updateTask }),
      events,
    );

    await runMutation(
      'createTask',
      {
        input: {
          position: 1000,
          projectId,
          statusId,
          title: ' Prepare release ',
        },
      },
      value,
    );
    await runMutation(
      'updateTask',
      {
        id: taskId,
        input: { priority: 'high', title: 'Prepare production release' },
      },
      value,
    );

    expect(createTask).toHaveBeenCalledWith(
      {
        position: 1000,
        priority: 'medium',
        project_id: projectId,
        status_id: statusId,
        title: 'Prepare release',
      },
      user.id,
    );
    expect(updateTask).toHaveBeenCalledWith(taskId, {
      priority: 'high',
      title: 'Prepare production release',
    });
    expect(events.publishTask).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ kind: 'created', projectId, taskId }),
    );
    expect(events.publishTask).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ kind: 'updated', projectId, taskId }),
    );
  });

  it('moves, assigns, and deletes a task through the complete workflow', async () => {
    const movedTask: Task = {
      ...task,
      position: 500,
      status_id: nextStatusId,
    };
    const assignment: TaskAssignee = {
      assigned_at: timestamp,
      assigned_by: user.id,
      task_id: taskId,
      user_id: assigneeId,
    };
    const moveTask = vi.fn().mockResolvedValue(movedTask);
    const assignTask = vi.fn().mockResolvedValue(assignment);
    const findTask = vi.fn().mockResolvedValue(task);
    const deleteTask = vi.fn().mockResolvedValue(taskId);
    const events = createEvents();
    const value = context(
      createDataService({ assignTask, deleteTask, moveTask, task: findTask }),
      events,
    );

    await runMutation(
      'moveTask',
      { id: taskId, input: { position: 500, statusId: nextStatusId } },
      value,
    );
    await runMutation('assignTask', { assigneeId, taskId }, value);
    await runMutation('deleteTask', { id: taskId }, value);

    expect(moveTask).toHaveBeenCalledWith(taskId, nextStatusId, 500);
    expect(assignTask).toHaveBeenCalledWith(taskId, assigneeId, user.id);
    expect(findTask).toHaveBeenCalledWith(taskId);
    expect(deleteTask).toHaveBeenCalledWith(taskId);
    expect(events.publishTask).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ kind: 'updated', projectId, taskId }),
    );
    expect(events.publishTask).toHaveBeenNthCalledWith(2, {
      kind: 'deleted',
      projectId,
      task: null,
      taskId,
    } satisfies TaskEvent);
  });

  it('rejects protected mutations before the data layer without authentication', async () => {
    const createTask = vi.fn();

    await expect(
      runMutation(
        'createTask',
        { input: { projectId, statusId, title: 'Not allowed' } },
        context(createDataService({ createTask }), createEvents(), null),
      ),
    ).rejects.toMatchObject({ extensions: { code: 'UNAUTHENTICATED' } });
    expect(createTask).not.toHaveBeenCalled();
  });

  it('rejects invalid task input before it reaches the data layer', async () => {
    const createTask = vi.fn();

    await expect(
      runMutation(
        'createTask',
        { input: { position: -1, projectId, statusId, title: '   ' } },
        context(createDataService({ createTask })),
      ),
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
    expect(createTask).not.toHaveBeenCalled();
  });
});

describe('GraphQL reminder workflow resolvers', () => {
  it('creates a reminder with normalized schedule, channels, and recipients', async () => {
    const createTaskReminder = vi.fn().mockResolvedValue(reminder);

    await expect(
      runMutation(
        'createTaskReminder',
        {
          input: {
            emailEnabled: true,
            nextRunAt,
            recipientIds: [user.id, assigneeId],
            scheduleKind: 'weekly',
            taskId,
            timezone: ' Europe/Sofia ',
          },
        },
        context(createDataService({ createTaskReminder })),
      ),
    ).resolves.toEqual(reminder);
    expect(createTaskReminder).toHaveBeenCalledWith({
      email_enabled: true,
      in_app_enabled: true,
      next_run_at: nextRunAt,
      recipient_ids: [user.id, assigneeId],
      schedule_kind: 'weekly',
      stop_when_completed: true,
      task_id: taskId,
      timezone: 'Europe/Sofia',
    });
  });

  it('updates, pauses, resumes, replaces recipients, and deletes a reminder', async () => {
    const updateTaskReminder = vi.fn().mockResolvedValue(reminder);
    const updateTaskReminderStatus = vi.fn().mockResolvedValue(reminder);
    const replaceTaskReminderRecipients = vi.fn().mockResolvedValue(reminder);
    const deleteTaskReminder = vi.fn().mockResolvedValue(reminderId);
    const value = context(
      createDataService({
        deleteTaskReminder,
        replaceTaskReminderRecipients,
        updateTaskReminder,
        updateTaskReminderStatus,
      }),
    );

    await runMutation(
      'updateTaskReminder',
      {
        id: reminderId,
        input: { emailEnabled: true, scheduleKind: 'monthly' },
      },
      value,
    );
    await runMutation('pauseTaskReminder', { id: reminderId }, value);
    await runMutation('resumeTaskReminder', { id: reminderId }, value);
    await runMutation(
      'replaceTaskReminderRecipients',
      { id: reminderId, recipientIds: [assigneeId] },
      value,
    );
    await expect(
      runMutation('deleteTaskReminder', { id: reminderId }, value),
    ).resolves.toEqual({ id: reminderId });

    expect(updateTaskReminder).toHaveBeenCalledWith(reminderId, {
      email_enabled: true,
      schedule_kind: 'monthly',
    });
    expect(updateTaskReminderStatus).toHaveBeenNthCalledWith(
      1,
      reminderId,
      'paused',
    );
    expect(updateTaskReminderStatus).toHaveBeenNthCalledWith(
      2,
      reminderId,
      'active',
    );
    expect(replaceTaskReminderRecipients).toHaveBeenCalledWith(reminderId, [
      assigneeId,
    ]);
    expect(deleteTaskReminder).toHaveBeenCalledWith(reminderId);
  });

  it('reads reminders, preferences, and the workspace plan through the authenticated service', async () => {
    const taskReminders = vi.fn().mockResolvedValue([reminder]);
    const notificationPreferences = vi.fn().mockResolvedValue(preferences);
    const workspaceSubscription = vi.fn().mockResolvedValue({ plan: {} });
    const value = context(
      createDataService({
        notificationPreferences,
        taskReminders,
        workspaceSubscription,
      }),
    );

    await expect(runQuery('taskReminders', { taskId }, value)).resolves.toEqual(
      [reminder],
    );
    await expect(
      runQuery('notificationPreferences', {}, value),
    ).resolves.toEqual(preferences);
    await runQuery('workspaceSubscription', { workspaceId }, value);

    expect(taskReminders).toHaveBeenCalledWith(taskId);
    expect(notificationPreferences).toHaveBeenCalledWith(user.id);
    expect(workspaceSubscription).toHaveBeenCalledWith(workspaceId);
  });

  it('updates only the supplied notification preferences for the current user', async () => {
    const updateNotificationPreferences = vi
      .fn()
      .mockResolvedValue({ ...preferences, reminder_enabled: false });

    await runMutation(
      'updateNotificationPreferences',
      { input: { reminderEnabled: false } },
      context(createDataService({ updateNotificationPreferences })),
    );

    expect(updateNotificationPreferences).toHaveBeenCalledWith(user.id, {
      reminder_enabled: false,
    });
  });

  it('rejects duplicate recipients and disabled channels before persistence', async () => {
    const createTaskReminder = vi.fn();
    const value = context(createDataService({ createTaskReminder }));

    await expect(
      runMutation(
        'createTaskReminder',
        {
          input: {
            emailEnabled: false,
            inAppEnabled: false,
            nextRunAt,
            recipientIds: [user.id, user.id],
            scheduleKind: 'once',
            taskId,
          },
        },
        value,
      ),
    ).rejects.toMatchObject({ extensions: { code: 'BAD_USER_INPUT' } });
    expect(createTaskReminder).not.toHaveBeenCalled();
  });
});
