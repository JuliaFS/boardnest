import { describe, expect, it, vi } from 'vitest';

import type { PublicAuthUser } from '../auth/auth-service.js';
import type { RealtimeEventBus, TaskEvent } from '../realtime/event-bus.js';
import type { BoardnestDataService } from './data-service.js';
import type { Project, Task, TaskAssignee } from './domain.js';
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
const timestamp = new Date(0).toISOString();

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

type MutationResolver = (
  parent: unknown,
  args: Record<string, unknown>,
  context: GraphQLContext,
) => unknown;

const mutations = resolvers.Mutation as unknown as Record<
  string,
  MutationResolver
>;

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

describe('GraphQL project and task workflow resolvers', () => {
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
