import { GraphQLError, GraphQLScalarType, Kind } from 'graphql';
import { z } from 'zod';

import type { PublicAuthUser } from '../auth/auth-service.js';
import type {
  RealtimeEventBus,
  TaskEvent,
  TaskEventKind,
} from '../realtime/event-bus.js';
import type { BoardnestDataService } from './data-service.js';
import type { InvitationEmailService } from '../invitations/invitation-email.js';
import type {
  CreateProjectData,
  CreateTaskData,
  CreateTaskReminderData,
  Pagination,
  UpdateNotificationPreferencesData,
  UpdateProjectData,
  UpdateTaskData,
  UpdateTaskReminderData,
} from './domain.js';

export interface GraphQLContext {
  data: BoardnestDataService | null;
  events: RealtimeEventBus;
  invitationEmail?: InvitationEmailService;
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
const workspaceMemberRoleSchema = z.enum(['admin', 'member', 'viewer']);
const invitationTokenSchema = z
  .string()
  .length(43)
  .regex(/^[A-Za-z0-9_-]{43}$/);
const reminderScheduleKindSchema = z.enum([
  'once',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
]);
const recipientIdsSchema = z
  .array(z.uuid())
  .min(1)
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'Recipients must be unique.',
  });
const createTaskReminderSchema = z
  .object({
    emailEnabled: z.boolean().default(false),
    endsAt: z.iso.datetime().nullable().optional(),
    inAppEnabled: z.boolean().default(true),
    nextRunAt: z.iso.datetime(),
    recipientIds: recipientIdsSchema,
    scheduleKind: reminderScheduleKindSchema,
    stopWhenCompleted: z.boolean().default(true),
    taskId: z.uuid(),
    timezone: z.string().trim().min(1).max(100).default('UTC'),
  })
  .refine((input) => input.inAppEnabled || input.emailEnabled, {
    message: 'At least one notification channel must be enabled.',
  })
  .refine(
    (input) =>
      input.endsAt === null ||
      input.endsAt === undefined ||
      Date.parse(input.endsAt) > Date.parse(input.nextRunAt),
    { message: 'The end date must be after the next run date.' },
  );
const updateTaskReminderSchema = z
  .object({
    emailEnabled: z.boolean().optional(),
    endsAt: z.iso.datetime().nullable().optional(),
    inAppEnabled: z.boolean().optional(),
    nextRunAt: z.iso.datetime().optional(),
    scheduleKind: reminderScheduleKindSchema.optional(),
    stopWhenCompleted: z.boolean().optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
  })
  .refine((input) => Object.keys(input).length > 0, 'No changes supplied.')
  .refine(
    (input) => !(input.inAppEnabled === false && input.emailEnabled === false),
    'At least one notification channel must be enabled.',
  )
  .refine(
    (input) =>
      input.endsAt === null ||
      input.endsAt === undefined ||
      input.nextRunAt === undefined ||
      Date.parse(input.endsAt) > Date.parse(input.nextRunAt),
    'The end date must be after the next run date.',
  );
const updateNotificationPreferencesSchema = z
  .object({
    emailEnabled: z.boolean().optional(),
    inAppEnabled: z.boolean().optional(),
    reminderEnabled: z.boolean().optional(),
    taskAssignedEnabled: z.boolean().optional(),
    taskCreatedEnabled: z.boolean().optional(),
  })
  .refine((input) => Object.keys(input).length > 0, 'No changes supplied.');

export const typeDefs = `#graphql
  scalar JSON

  enum ProjectVisibility { WORKSPACE PRIVATE }
  enum ProjectStatus { PLANNED ACTIVE ON_HOLD COMPLETED }
  enum TaskPriority { NONE LOW MEDIUM HIGH URGENT }
  enum WorkspaceRole { OWNER ADMIN MEMBER VIEWER }
  enum ReminderScheduleKind { ONCE WEEKLY MONTHLY QUARTERLY YEARLY }
  enum ReminderStatus { ACTIVE PAUSED COMPLETED CANCELED }

  type User {
    id: ID!
    email: String
    displayName: String
    isAnonymous: Boolean!
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
    createdBy: ID
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
    createdBy: ID
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
    reminderId: ID
    scheduledFor: String
    type: String!
    title: String!
    body: String
    payload: JSON!
    readAt: String
    createdAt: String!
  }

  type NotificationPreferences {
    userId: ID!
    inAppEnabled: Boolean!
    emailEnabled: Boolean!
    taskCreatedEnabled: Boolean!
    taskAssignedEnabled: Boolean!
    reminderEnabled: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type SubscriptionPlan {
    code: String!
    displayName: String!
    description: String!
    maxActiveReminderTasks: Int!
    maxRemindersPerTask: Int!
    maxRecipientsPerReminder: Int!
    monthlyEmailLimit: Int!
    emailEnabled: Boolean!
    notificationRetentionDays: Int!
  }

  type WorkspaceSubscription {
    workspaceId: ID!
    planCode: String!
    effectivePlanCode: String!
    status: String!
    provider: String!
    currentPeriodStart: String
    currentPeriodEnd: String
    cancelAtPeriodEnd: Boolean!
    plan: SubscriptionPlan!
  }

  type TaskReminder {
    id: ID!
    taskId: ID!
    projectId: ID!
    workspaceId: ID!
    createdBy: ID!
    scheduleKind: ReminderScheduleKind!
    timezone: String!
    nextRunAt: String!
    endsAt: String
    lastRunAt: String
    inAppEnabled: Boolean!
    emailEnabled: Boolean!
    stopWhenCompleted: Boolean!
    status: ReminderStatus!
    recipientIds: [ID!]!
    createdAt: String!
    updatedAt: String!
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

  type WorkspaceMember {
    workspaceId: ID!
    userId: ID!
    displayName: String!
    avatarUrl: String
    role: WorkspaceRole!
    joinedAt: String!
    updatedAt: String!
  }

  type InvitationAcceptance {
    workspaceId: ID!
    userId: ID!
    role: WorkspaceRole!
    joinedAt: String!
  }

  type WorkspaceConnection { nodes: [Workspace!]!, pageInfo: PageInfo! }
  type ProjectConnection { nodes: [Project!]!, pageInfo: PageInfo! }
  type TaskConnection { nodes: [Task!]!, pageInfo: PageInfo! }
  type NotificationConnection { nodes: [Notification!]!, pageInfo: PageInfo! }
  type ActivityConnection { nodes: [ActivityLog!]!, pageInfo: PageInfo! }
  type WorkspaceMemberConnection { nodes: [WorkspaceMember!]!, pageInfo: PageInfo! }
  type InvitationConnection { nodes: [Invitation!]!, pageInfo: PageInfo! }
  type DeletePayload { id: ID! }
  type InvitationPayload { invitation: Invitation!, token: String, emailSent: Boolean! }

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
  input CreateTaskReminderInput {
    taskId: ID!
    scheduleKind: ReminderScheduleKind!
    timezone: String = "UTC"
    nextRunAt: String!
    endsAt: String
    inAppEnabled: Boolean = true
    emailEnabled: Boolean = false
    stopWhenCompleted: Boolean = true
    recipientIds: [ID!]!
  }
  input UpdateTaskReminderInput {
    scheduleKind: ReminderScheduleKind
    timezone: String
    nextRunAt: String
    endsAt: String
    inAppEnabled: Boolean
    emailEnabled: Boolean
    stopWhenCompleted: Boolean
  }
  input UpdateNotificationPreferencesInput {
    inAppEnabled: Boolean
    emailEnabled: Boolean
    taskCreatedEnabled: Boolean
    taskAssignedEnabled: Boolean
    reminderEnabled: Boolean
  }

  type Query {
    currentUser: User
    workspaces(limit: Int = 25, offset: Int = 0): WorkspaceConnection!
    workspace(id: ID!): Workspace
    workspaceMembers(workspaceId: ID!, limit: Int = 100, offset: Int = 0): WorkspaceMemberConnection!
    workspaceInvitations(workspaceId: ID!, limit: Int = 100, offset: Int = 0): InvitationConnection!
    projects(workspaceId: ID!, limit: Int = 25, offset: Int = 0): ProjectConnection!
    project(id: ID!): Project
    tasks(projectId: ID!, statusId: ID, search: String, limit: Int = 50, offset: Int = 0): TaskConnection!
    task(id: ID!): Task
    taskStatuses(projectId: ID!): [TaskStatus!]!
    notifications(unreadOnly: Boolean = false, limit: Int = 25, offset: Int = 0): NotificationConnection!
    notificationPreferences: NotificationPreferences!
    workspaceSubscription(workspaceId: ID!): WorkspaceSubscription
    taskReminders(taskId: ID!): [TaskReminder!]!
    taskReminder(id: ID!): TaskReminder
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
    acceptInvitation(token: String!): InvitationAcceptance!
    updateWorkspaceMemberRole(workspaceId: ID!, userId: ID!, role: WorkspaceRole!): WorkspaceMember!
    removeWorkspaceMember(workspaceId: ID!, userId: ID!): DeletePayload!
    revokeInvitation(id: ID!): Invitation!
    markNotificationAsRead(id: ID!): Notification!
    createTaskReminder(input: CreateTaskReminderInput!): TaskReminder!
    updateTaskReminder(id: ID!, input: UpdateTaskReminderInput!): TaskReminder!
    pauseTaskReminder(id: ID!): TaskReminder!
    resumeTaskReminder(id: ID!): TaskReminder!
    replaceTaskReminderRecipients(id: ID!, recipientIds: [ID!]!): TaskReminder!
    deleteTaskReminder(id: ID!): DeletePayload!
    updateNotificationPreferences(input: UpdateNotificationPreferencesInput!): NotificationPreferences!
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
  ReminderScheduleKind: {
    MONTHLY: 'monthly',
    ONCE: 'once',
    QUARTERLY: 'quarterly',
    WEEKLY: 'weekly',
    YEARLY: 'yearly',
  },
  ReminderStatus: {
    ACTIVE: 'active',
    CANCELED: 'canceled',
    COMPLETED: 'completed',
    PAUSED: 'paused',
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
    'reminderId',
    'scheduledFor',
    'readAt',
    'createdAt',
  ]),
  NotificationPreferences: snakeCaseFields([
    'userId',
    'inAppEnabled',
    'emailEnabled',
    'taskCreatedEnabled',
    'taskAssignedEnabled',
    'reminderEnabled',
    'createdAt',
    'updatedAt',
  ]),
  SubscriptionPlan: snakeCaseFields([
    'displayName',
    'maxActiveReminderTasks',
    'maxRemindersPerTask',
    'maxRecipientsPerReminder',
    'monthlyEmailLimit',
    'emailEnabled',
    'notificationRetentionDays',
  ]),
  WorkspaceSubscription: snakeCaseFields([
    'workspaceId',
    'planCode',
    'effectivePlanCode',
    'currentPeriodStart',
    'currentPeriodEnd',
    'cancelAtPeriodEnd',
  ]),
  TaskReminder: snakeCaseFields([
    'taskId',
    'projectId',
    'workspaceId',
    'createdBy',
    'scheduleKind',
    'nextRunAt',
    'endsAt',
    'lastRunAt',
    'inAppEnabled',
    'emailEnabled',
    'stopWhenCompleted',
    'recipientIds',
    'createdAt',
    'updatedAt',
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
  WorkspaceMember: snakeCaseFields([
    'workspaceId',
    'userId',
    'displayName',
    'avatarUrl',
    'joinedAt',
    'updatedAt',
  ]),
  InvitationAcceptance: snakeCaseFields(['workspaceId', 'userId', 'joinedAt']),
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
    workspaceMembers: async (
      _parent: unknown,
      args: PaginationArguments & { workspaceId: string },
      context: GraphQLContext,
    ) =>
      requireAuth(context).data.workspaceMembers(
        uuid(args.workspaceId),
        pagination(args),
      ),
    workspaceInvitations: async (
      _parent: unknown,
      args: PaginationArguments & { workspaceId: string },
      context: GraphQLContext,
    ) =>
      requireAuth(context).data.workspaceInvitations(
        uuid(args.workspaceId),
        pagination(args),
      ),
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
    notificationPreferences: async (
      _parent: unknown,
      _args: unknown,
      context: GraphQLContext,
    ) => {
      const authenticated = requireAuth(context);
      return authenticated.data.notificationPreferences(authenticated.user.id);
    },
    workspaceSubscription: async (
      _parent: unknown,
      args: { workspaceId: string },
      context: GraphQLContext,
    ) =>
      requireAuth(context).data.workspaceSubscription(uuid(args.workspaceId)),
    taskReminders: async (
      _parent: unknown,
      args: { taskId: string },
      context: GraphQLContext,
    ) => requireAuth(context).data.taskReminders(uuid(args.taskId)),
    taskReminder: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => requireAuth(context).data.taskReminder(uuid(args.id)),
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
      const result = await authenticated.data.inviteMember(
        input.workspaceId,
        input.email,
        input.role,
        authenticated.user.id,
      );
      let emailSent = false;
      if (context.invitationEmail) {
        const workspace = await authenticated.data.workspace(input.workspaceId);
        if (workspace) {
          try {
            await context.invitationEmail.sendWorkspaceInvitation({
              email: result.invitation.email,
              inviterName:
                authenticated.user.displayName ?? 'A Boardnest member',
              token: result.token,
              workspaceName: workspace.name,
            });
            emailSent = true;
          } catch (error) {
            console.error(
              'Invitation email delivery failed',
              error instanceof Error ? error.message : 'Unknown email error',
            );
          }
        }
      }
      return {
        ...result,
        emailSent,
        token: emailSent ? null : result.token,
      };
    },
    acceptInvitation: async (
      _parent: unknown,
      args: { token: string },
      context: GraphQLContext,
    ) =>
      requireAuth(context).data.acceptInvitation(
        parse(invitationTokenSchema, args.token),
      ),
    updateWorkspaceMemberRole: async (
      _parent: unknown,
      args: { role: string; userId: string; workspaceId: string },
      context: GraphQLContext,
    ) =>
      requireAuth(context).data.updateWorkspaceMemberRole(
        uuid(args.workspaceId),
        uuid(args.userId),
        parse(workspaceMemberRoleSchema, args.role),
      ),
    removeWorkspaceMember: async (
      _parent: unknown,
      args: { userId: string; workspaceId: string },
      context: GraphQLContext,
    ) => ({
      id: await requireAuth(context).data.removeWorkspaceMember(
        uuid(args.workspaceId),
        uuid(args.userId),
      ),
    }),
    revokeInvitation: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => requireAuth(context).data.revokeInvitation(uuid(args.id)),
    markNotificationAsRead: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => requireAuth(context).data.markNotificationAsRead(uuid(args.id)),
    createTaskReminder: async (
      _parent: unknown,
      args: { input: unknown },
      context: GraphQLContext,
    ) =>
      requireAuth(context).data.createTaskReminder(
        toCreateTaskReminderData(parse(createTaskReminderSchema, args.input)),
      ),
    updateTaskReminder: async (
      _parent: unknown,
      args: { id: string; input: unknown },
      context: GraphQLContext,
    ) =>
      requireAuth(context).data.updateTaskReminder(
        uuid(args.id),
        toUpdateTaskReminderData(parse(updateTaskReminderSchema, args.input)),
      ),
    pauseTaskReminder: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) =>
      requireAuth(context).data.updateTaskReminderStatus(
        uuid(args.id),
        'paused',
      ),
    resumeTaskReminder: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) =>
      requireAuth(context).data.updateTaskReminderStatus(
        uuid(args.id),
        'active',
      ),
    replaceTaskReminderRecipients: async (
      _parent: unknown,
      args: { id: string; recipientIds: unknown },
      context: GraphQLContext,
    ) =>
      requireAuth(context).data.replaceTaskReminderRecipients(
        uuid(args.id),
        parse(recipientIdsSchema, args.recipientIds),
      ),
    deleteTaskReminder: async (
      _parent: unknown,
      args: { id: string },
      context: GraphQLContext,
    ) => ({
      id: await requireAuth(context).data.deleteTaskReminder(uuid(args.id)),
    }),
    updateNotificationPreferences: async (
      _parent: unknown,
      args: { input: unknown },
      context: GraphQLContext,
    ) => {
      const authenticated = requireAuth(context);
      return authenticated.data.updateNotificationPreferences(
        authenticated.user.id,
        toUpdateNotificationPreferencesData(
          parse(updateNotificationPreferencesSchema, args.input),
        ),
      );
    },
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

function toCreateTaskReminderData(
  input: z.infer<typeof createTaskReminderSchema>,
): CreateTaskReminderData {
  return {
    email_enabled: input.emailEnabled,
    ...(input.endsAt !== undefined ? { ends_at: input.endsAt } : {}),
    in_app_enabled: input.inAppEnabled,
    next_run_at: input.nextRunAt,
    recipient_ids: input.recipientIds,
    schedule_kind: input.scheduleKind,
    stop_when_completed: input.stopWhenCompleted,
    task_id: input.taskId,
    timezone: input.timezone,
  };
}

function toUpdateTaskReminderData(
  input: z.infer<typeof updateTaskReminderSchema>,
): UpdateTaskReminderData {
  return {
    ...(input.emailEnabled !== undefined
      ? { email_enabled: input.emailEnabled }
      : {}),
    ...(input.endsAt !== undefined ? { ends_at: input.endsAt } : {}),
    ...(input.inAppEnabled !== undefined
      ? { in_app_enabled: input.inAppEnabled }
      : {}),
    ...(input.nextRunAt !== undefined ? { next_run_at: input.nextRunAt } : {}),
    ...(input.scheduleKind !== undefined
      ? { schedule_kind: input.scheduleKind }
      : {}),
    ...(input.stopWhenCompleted !== undefined
      ? { stop_when_completed: input.stopWhenCompleted }
      : {}),
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
  };
}

function toUpdateNotificationPreferencesData(
  input: z.infer<typeof updateNotificationPreferencesSchema>,
): UpdateNotificationPreferencesData {
  return {
    ...(input.emailEnabled !== undefined
      ? { email_enabled: input.emailEnabled }
      : {}),
    ...(input.inAppEnabled !== undefined
      ? { in_app_enabled: input.inAppEnabled }
      : {}),
    ...(input.reminderEnabled !== undefined
      ? { reminder_enabled: input.reminderEnabled }
      : {}),
    ...(input.taskAssignedEnabled !== undefined
      ? { task_assigned_enabled: input.taskAssignedEnabled }
      : {}),
    ...(input.taskCreatedEnabled !== undefined
      ? { task_created_enabled: input.taskCreatedEnabled }
      : {}),
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
