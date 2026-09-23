import { GraphQLError, GraphQLScalarType, Kind } from 'graphql';
import { z } from 'zod';

import type { PublicAuthUser } from '../auth/auth-service.js';
import type {
  RealtimeEventBus,
  TaskEvent,
  TaskEventKind,
} from '../realtime/event-bus.js';
import type { BoardnestDataService } from './data-service.js';
import type {
  CreateProjectData,
  CreateTaskData,
  Pagination,
  UpdateProjectData,
  UpdateTaskData,
} from './domain.js';

export interface GraphQLContext {
  data: BoardnestDataService | null;
  events: RealtimeEventBus;
  user: PublicAuthUser | null;
}

interface PaginationArguments {
  limit?: number | null;
  offset?: number | null;
}

const uuidSchema = z.uuid();
const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
});
const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});
const createProjectSchema = z.object({
  description: z.string().max(10_000).nullish(),
  dueDate: z.iso.date().nullish(),
  name: z.string().trim().min(1).max(120),
  startDate: z.iso.date().nullish(),
  status: z
    .enum(['planned', 'active', 'on_hold', 'completed'])
    .default('active'),
  visibility: z.enum(['workspace', 'private']).default('workspace'),
  workspaceId: z.uuid(),
});
const updateProjectSchema = createProjectSchema
  .omit({ workspaceId: true })
  .partial()
  .extend({ archivedAt: z.iso.datetime().nullable().optional() })
  .refine((input) => Object.keys(input).length > 0, 'No changes supplied.');
const createTaskSchema = z.object({
  description: z.string().max(50_000).nullish(),
  dueAt: z.iso.datetime().nullish(),
  position: z.number().nonnegative().default(1000),
  priority: z
    .enum(['none', 'low', 'medium', 'high', 'urgent'])
    .default('medium'),
  projectId: z.uuid(),
  statusId: z.uuid(),
  title: z.string().trim().min(1).max(240),
});
const updateTaskSchema = createTaskSchema
  .omit({ position: true, projectId: true, statusId: true })
  .partial()
  .extend({ archivedAt: z.iso.datetime().nullable().optional() })
  .refine((input) => Object.keys(input).length > 0, 'No changes supplied.');
const inviteSchema = z.object({
  email: z.email(),
  role: z.enum(['admin', 'member', 'viewer']),
  workspaceId: z.uuid(),
});

export const typeDefs = `#graphql
  scalar JSON

  enum ProjectVisibility { WORKSPACE PRIVATE }
  enum ProjectStatus { PLANNED ACTIVE ON_HOLD COMPLETED }
  enum TaskPriority { NONE LOW MEDIUM HIGH URGENT }
  enum WorkspaceRole { OWNER ADMIN MEMBER VIEWER }

  type User {
    id: ID!
    email: String
    displayName: String
    role: String!
  }

  type PageInfo {
    hasNextPage: Boolean!
    limit: Int!
    offset: Int!
  }

  type Workspace {
    id: ID!
    name: String!
    slug: String!
    createdBy: ID!
    archivedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type Project {
    id: ID!
    workspaceId: ID!
    name: String!
    description: String
    visibility: ProjectVisibility!
    status: ProjectStatus!
    createdBy: ID!
    startDate: String
    dueDate: String
    archivedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type Task {
    id: ID!
    projectId: ID!
    statusId: ID!
    title: String!
    description: String
    priority: TaskPriority!
    position: Float!
    createdBy: ID
    dueAt: String
    archivedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type TaskStatus {
    id: ID!
    projectId: ID!
    name: String!
    category: String!
    color: String!
    position: Int!
    createdAt: String!
    updatedAt: String!
  }

  type TaskAssignee {
    taskId: ID!
    userId: ID!
    assignedBy: ID
    assignedAt: String!
  }

  type TaskComment {
    id: ID!
    taskId: ID!
    authorId: ID
    body: String!
    editedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type Notification {
    id: ID!
    userId: ID!
    workspaceId: ID!
    projectId: ID
    taskId: ID
    type: String!
    title: String!
    body: String
    payload: JSON!
    readAt: String
    createdAt: String!
  }

  type ActivityLog {
    id: ID!
    workspaceId: ID!
    projectId: ID
    taskId: ID
    actorId: ID
    eventType: String!
    entityType: String!
    entityId: ID
    metadata: JSON!
    createdAt: String!
  }

  type Invitation {
    id: ID!
    workspaceId: ID!
    email: String!
    role: WorkspaceRole!
    status: String!
    invitedBy: ID
    acceptedBy: ID
    expiresAt: String!
    acceptedAt: String
    revokedAt: String
    createdAt: String!
    updatedAt: String!
  }

  type WorkspaceConnection { nodes: [Workspace!]!, pageInfo: PageInfo! }
  type ProjectConnection { nodes: [Project!]!, pageInfo: PageInfo! }
  type TaskConnection { nodes: [Task!]!, pageInfo: PageInfo! }
  type NotificationConnection { nodes: [Notification!]!, pageInfo: PageInfo! }
  type ActivityConnection { nodes: [ActivityLog!]!, pageInfo: PageInfo! }
  type DeletePayload { id: ID! }
  type InvitationPayload { invitation: Invitation!, token: String! }

  input CreateWorkspaceInput { name: String!, slug: String! }
  input CreateProjectInput {
    workspaceId: ID!
    name: String!
    description: String
    visibility: ProjectVisibility = WORKSPACE
    status: ProjectStatus = ACTIVE
    startDate: String
    dueDate: String
  }
  input UpdateProjectInput {
    name: String
    description: String
    visibility: ProjectVisibility
    status: ProjectStatus
    startDate: String
    dueDate: String
    archivedAt: String
  }
  input CreateTaskInput {
    projectId: ID!
    statusId: ID!
    title: String!
    description: String
    priority: TaskPriority = MEDIUM
    position: Float = 1000
    dueAt: String
  }
  input UpdateTaskInput {
    title: String
    description: String
    priority: TaskPriority
    dueAt: String
    archivedAt: String
  }
  input MoveTaskInput { statusId: ID!, position: Float! }
  input InviteMemberInput {
    workspaceId: ID!
    email: String!
    role: WorkspaceRole = MEMBER
  }

  type Query {
    currentUser: User
    workspaces(limit: Int = 25, offset: Int = 0): WorkspaceConnection!
    workspace(id: ID!): Workspace
    projects(workspaceId: ID!, limit: Int = 25, offset: Int = 0): ProjectConnection!
    project(id: ID!): Project
    tasks(projectId: ID!, statusId: ID, search: String, limit: Int = 50, offset: Int = 0): TaskConnection!
    task(id: ID!): Task
    taskStatuses(projectId: ID!): [TaskStatus!]!
    notifications(unreadOnly: Boolean = false, limit: Int = 25, offset: Int = 0): NotificationConnection!
    activityFeed(workspaceId: ID!, projectId: ID, limit: Int = 25, offset: Int = 0): ActivityConnection!
  }

  type Mutation {
    createWorkspace(input: CreateWorkspaceInput!): Workspace!
    createProject(input: CreateProjectInput!): Project!
    updateProject(id: ID!, input: UpdateProjectInput!): Project!
    deleteProject(id: ID!): DeletePayload!
    createTask(input: CreateTaskInput!): Task!
    updateTask(id: ID!, input: UpdateTaskInput!): Task!
    deleteTask(id: ID!): DeletePayload!
    moveTask(id: ID!, input: MoveTaskInput!): Task!
    assignTask(taskId: ID!, assigneeId: ID!): TaskAssignee!
    addComment(taskId: ID!, body: String!): TaskComment!
    inviteMember(input: InviteMemberInput!): InvitationPayload!
    markNotificationAsRead(id: ID!): Notification!
  }

  type Subscription {
    taskCreated(projectId: ID!): Task!
    taskUpdated(projectId: ID!): Task!
    taskDeleted(projectId: ID!): DeletePayload!
  }
`;

const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'A JSON-compatible value.',
  parseLiteral(node): unknown {
    return parseJsonLiteral(node);
  },
  parseValue(value): unknown {
    return value;
  },
  serialize(value): unknown {
    return value;
  },
});

export const resolvers = {
  JSON: JSONScalar,
  ProjectStatus: {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    ON_HOLD: 'on_hold',
    PLANNED: 'planned',
  },
  ProjectVisibility: { PRIVATE: 'private', WORKSPACE: 'workspace' },
  TaskPriority: {
    HIGH: 'high',
    LOW: 'low',
    MEDIUM: 'medium',
    NONE: 'none',
    URGENT: 'urgent',
  },
  WorkspaceRole: {
    ADMIN: 'admin',
    MEMBER: 'member',
    OWNER: 'owner',
    VIEWER: 'viewer',
  },
  Workspace: snakeCaseFields([
    'createdBy',
    'archivedAt',
    'createdAt',
    'updatedAt',
  ]),
  Project: snakeCaseFields([
    'workspaceId',
    'createdBy',
    'startDate',
    'dueDate',
    'archivedAt',
    'createdAt',
    'updatedAt',
  ]),
  Task: snakeCaseFields([
    'projectId',
    'statusId',
    'createdBy',
    'dueAt',
    'archivedAt',
    'createdAt',
    'updatedAt',
  ]),
  TaskAssignee: snakeCaseFields([
    'taskId',
    'userId',
    'assignedBy',
    'assignedAt',
  ]),
  TaskStatus: snakeCaseFields(['projectId', 'createdAt', 'updatedAt']),
  TaskComment: snakeCaseFields([
    'taskId',
    'authorId',
    'editedAt',
    'createdAt',
    'updatedAt',
  ]),
  Notification: snakeCaseFields([
    'userId',
    'workspaceId',
    'projectId',
    'taskId',
    'readAt',
    'createdAt',
  ]),
  ActivityLog: snakeCaseFields([
    'workspaceId',
    'projectId',
    'taskId',
    'actorId',
    'eventType',
    'entityType',
    'entityId',
    'createdAt',
  ]),
  Invitation: snakeCaseFields([
    'workspaceId',
    'invitedBy',
    'acceptedBy',
    'expiresAt',
    'acceptedAt',
    'revokedAt',
    'createdAt',
    'updatedAt',
  ]),
  Query: {
    currentUser: (_parent: unknown, _args: unknown, context: GraphQLContext) =>
      context.user,
    workspaces: async (
      _parent: unknown,
      args: PaginationArguments,
      context: GraphQLContext,
    ) => requireAuth(context).data.workspaces(pagination(args)),
    workspace: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => requireAuth(context).data.workspace(uuid(args.id)),
    projects: async (
      _parent: unknown,
      args: PaginationArguments & { workspaceId: string },
      context: GraphQLContext,
    ) =>
      requireAuth(context).data.projects(
        uuid(args.workspaceId),
        pagination(args),
      ),
    project: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => requireAuth(context).data.project(uuid(args.id)),
    tasks: async (
      _parent: unknown,
      args: PaginationArguments & {
        projectId: string;
        search?: string | null;
        statusId?: string | null;
      },
      context: GraphQLContext,
    ) =>
      requireAuth(context).data.tasks(
        uuid(args.projectId),
        args.statusId ? uuid(args.statusId) : null,
        args.search?.trim() || null,
        pagination(args),
      ),
    task: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => requireAuth(context).data.task(uuid(args.id)),
    taskStatuses: async (
      _parent: unknown,
      args: { projectId: string },
      context: GraphQLContext,
    ) => requireAuth(context).data.taskStatuses(uuid(args.projectId)),
    notifications: async (
      _parent: unknown,
      args: PaginationArguments & { unreadOnly?: boolean | null },
      context: GraphQLContext,
    ) => {
      const authenticated = requireAuth(context);
      return authenticated.data.notifications(
        authenticated.user.id,
        args.unreadOnly ?? false,
        pagination(args),
      );
    },
    activityFeed: async (
      _parent: unknown,
      args: PaginationArguments & {
        projectId?: string | null;
        workspaceId: string;
      },
      context: GraphQLContext,
    ) =>
      requireAuth(context).data.activityFeed(
        uuid(args.workspaceId),
        args.projectId ? uuid(args.projectId) : null,
        pagination(args),
      ),
  },
  Mutation: {
    createWorkspace: async (
      _parent: unknown,
      args: { input: unknown },
      context: GraphQLContext,
    ) => {
      const authenticated = requireAuth(context);
      const input = parse(createWorkspaceSchema, args.input);
      return authenticated.data.createWorkspace(
        input.name,
        input.slug,
        authenticated.user.id,
      );
    },
    createProject: async (
      _parent: unknown,
      args: { input: unknown },
      context: GraphQLContext,
    ) => {
      const authenticated = requireAuth(context);
      const input = parse(createProjectSchema, args.input);
      return authenticated.data.createProject(
        toCreateProjectData(input),
        authenticated.user.id,
      );
    },
    updateProject: async (
      _parent: unknown,
      args: { id: string; input: unknown },
      context: GraphQLContext,
    ) =>
      requireAuth(context).data.updateProject(
        uuid(args.id),
        toUpdateProjectData(parse(updateProjectSchema, args.input)),
      ),
    deleteProject: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => ({ id: await requireAuth(context).data.deleteProject(uuid(args.id)) }),
    createTask: async (
      _parent: unknown,
      args: { input: unknown },
      context: GraphQLContext,
    ) => {
      const authenticated = requireAuth(context);
      const input = parse(createTaskSchema, args.input);
      const task = await authenticated.data.createTask(
        toCreateTaskData(input),
        authenticated.user.id,
      );
      await context.events.publishTask(taskEvent('created', task));
      return task;
    },
    updateTask: async (
      _parent: unknown,
      args: { id: string; input: unknown },
      context: GraphQLContext,
    ) => {
      const task = await requireAuth(context).data.updateTask(
        uuid(args.id),
        toUpdateTaskData(parse(updateTaskSchema, args.input)),
      );
      await context.events.publishTask(taskEvent('updated', task));
      return task;
    },
    deleteTask: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => {
      const authenticated = requireAuth(context);
      const id = uuid(args.id);
      const task = await authenticated.data.task(id);
      if (!task) {
        throw new GraphQLError('The requested task was not found.', {
          extensions: { code: 'NOT_FOUND' },
        });
      }
      const deletedId = await authenticated.data.deleteTask(id);
      await context.events.publishTask({
        kind: 'deleted',
        projectId: task.project_id,
        task: null,
        taskId: deletedId,
      });
      return { id: deletedId };
    },
    moveTask: async (
      _parent: unknown,
      args: { id: string; input: { position: number; statusId: string } },
      context: GraphQLContext,
    ) => {
      const task = await requireAuth(context).data.moveTask(
        uuid(args.id),
        uuid(args.input.statusId),
        z.number().nonnegative().parse(args.input.position),
      );
      await context.events.publishTask(taskEvent('updated', task));
      return task;
    },
    assignTask: async (
      _parent: unknown,
      args: { assigneeId: string; taskId: string },
      context: GraphQLContext,
    ) => {
      const authenticated = requireAuth(context);
      return authenticated.data.assignTask(
        uuid(args.taskId),
        uuid(args.assigneeId),
        authenticated.user.id,
      );
    },
    addComment: async (
      _parent: unknown,
      args: { body: string; taskId: string },
      context: GraphQLContext,
    ) => {
      const authenticated = requireAuth(context);
      const body = parse(z.string().trim().min(1).max(20_000), args.body);
      return authenticated.data.addComment(
        uuid(args.taskId),
        body,
        authenticated.user.id,
      );
    },
    inviteMember: async (
      _parent: unknown,
      args: { input: unknown },
      context: GraphQLContext,
    ) => {
      const authenticated = requireAuth(context);
      const input = parse(inviteSchema, args.input);
      return authenticated.data.inviteMember(
        input.workspaceId,
        input.email,
        input.role,
        authenticated.user.id,
      );
    },
    markNotificationAsRead: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => requireAuth(context).data.markNotificationAsRead(uuid(args.id)),
  },
  Subscription: {
    taskCreated: taskSubscription('created'),
    taskDeleted: {
      resolve: async (
        event: TaskEvent,
        _args: unknown,
        context: GraphQLContext,
      ) => {
        await requireProjectAccess(context, event.projectId);
        return { id: event.taskId };
      },
      subscribe: subscribeToTaskEvents('deleted'),
    },
    taskUpdated: taskSubscription('updated'),
  },
};

function taskEvent(
  kind: Exclude<TaskEventKind, 'deleted'>,
  task: Awaited<ReturnType<BoardnestDataService['createTask']>>,
): TaskEvent {
  return {
    kind,
    projectId: task.project_id,
    task,
    taskId: task.id,
  };
}

function taskSubscription(kind: Exclude<TaskEventKind, 'deleted'>) {
  return {
    resolve: async (
      event: TaskEvent,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      await requireProjectAccess(context, event.projectId);
      return event.task;
    },
    subscribe: subscribeToTaskEvents(kind),
  };
}

function subscribeToTaskEvents(kind: TaskEventKind) {
  return async (
    _parent: unknown,
    args: { projectId: string },
    context: GraphQLContext,
  ) => {
    const projectId = uuid(args.projectId);
    await requireProjectAccess(context, projectId);
    return context.events.subscribeToTasks(projectId, kind);
  };
}

async function requireProjectAccess(
  context: GraphQLContext,
  projectId: string,
): Promise<void> {
  const project = await requireAuth(context).data.project(projectId);
  if (!project) {
    throw new GraphQLError('Project not found or access denied.', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
}

function requireAuth(context: GraphQLContext): {
  data: BoardnestDataService;
  user: PublicAuthUser;
} {
  if (!context.user || !context.data) {
    throw new GraphQLError('Authentication required.', {
      extensions: { code: 'UNAUTHENTICATED' },
    });
  }
  return { data: context.data, user: context.user };
}

function pagination(args: PaginationArguments): Pagination {
  return parse(paginationSchema, {
    limit: args.limit ?? undefined,
    offset: args.offset ?? undefined,
  });
}

function uuid(value: string): string {
  return parse(uuidSchema, value);
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new GraphQLError('Invalid input.', {
    extensions: {
      code: 'BAD_USER_INPUT',
      issues: result.error.issues.map((issue) => ({
        message: issue.message,
        path: issue.path,
      })),
    },
  });
}

function snakeCaseFields(
  fields: string[],
): Record<string, (source: Record<string, unknown>) => unknown> {
  return Object.fromEntries(
    fields.map((field) => [
      field,
      (source: Record<string, unknown>) => source[toSnakeCase(field)],
    ]),
  );
}

function toSnakeCase(value: string): string {
  return value.replaceAll(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCreateProjectData(
  input: z.infer<typeof createProjectSchema>,
): CreateProjectData {
  return {
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
    name: input.name,
    ...(input.startDate !== undefined ? { start_date: input.startDate } : {}),
    status: input.status,
    visibility: input.visibility,
    workspace_id: input.workspaceId,
  };
}

function toUpdateProjectData(
  input: z.infer<typeof updateProjectSchema>,
): UpdateProjectData {
  return {
    ...(input.archivedAt !== undefined
      ? { archived_at: input.archivedAt }
      : {}),
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.startDate !== undefined ? { start_date: input.startDate } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
  };
}

function toCreateTaskData(
  input: z.infer<typeof createTaskSchema>,
): CreateTaskData {
  return {
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.dueAt !== undefined ? { due_at: input.dueAt } : {}),
    position: input.position,
    priority: input.priority,
    project_id: input.projectId,
    status_id: input.statusId,
    title: input.title,
  };
}

function toUpdateTaskData(
  input: z.infer<typeof updateTaskSchema>,
): UpdateTaskData {
  return {
    ...(input.archivedAt !== undefined
      ? { archived_at: input.archivedAt }
      : {}),
    ...(input.description !== undefined
      ? { description: input.description }
      : {}),
    ...(input.dueAt !== undefined ? { due_at: input.dueAt } : {}),
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.title !== undefined ? { title: input.title } : {}),
  };
}

function parseJsonLiteral(
  node: Parameters<GraphQLScalarType['parseLiteral']>[0],
): unknown {
  switch (node.kind) {
    case Kind.NULL:
      return null;
    case Kind.BOOLEAN:
    case Kind.STRING:
      return node.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(node.value);
    case Kind.LIST:
      return node.values.map(parseJsonLiteral);
    case Kind.OBJECT:
      return Object.fromEntries(
        node.fields.map((field) => [
          field.name.value,
          parseJsonLiteral(field.value),
        ]),
      );
    default:
      return undefined;
  }
}
