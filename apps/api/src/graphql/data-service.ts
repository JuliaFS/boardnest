import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { GraphQLError } from 'graphql';
import { z } from 'zod';

import type {
  ActivityLog,
  Connection,
  CreateProjectData,
  CreateScheduledNotificationData,
  CreateTaskData,
  CreateTaskReminderData,
  Invitation,
  Notification,
  NotificationEventPreference,
  NotificationEventType,
  NotificationDelivery,
  NotificationPlanEvent,
  NotificationPreferences,
  UserDevice,
  Pagination,
  Project,
  ProjectMember,
  ScheduledNotification,
  SubscriptionPlan,
  Task,
  TaskAssignee,
  TaskComment,
  TaskReminder,
  TaskStatus,
  UpdateNotificationPreferencesData,
  UpdateNotificationEventPreferenceData,
  UpdateProjectData,
  UpdateScheduledNotificationData,
  UpdateTaskData,
  UpdateTaskReminderData,
  UpdateWorkspaceData,
  Workspace,
  WorkspaceMember,
  WorkspaceMembership,
  WorkspaceSubscription,
} from './domain.js';

const workspaceSchema = z.object({
  archived_at: z.string().nullable(),
  created_at: z.string(),
  created_by: z.uuid().nullable(),
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  updated_at: z.string(),
});
const projectSchema = z.object({
  archived_at: z.string().nullable(),
  created_at: z.string(),
  created_by: z.uuid().nullable(),
  description: z.string().nullable(),
  due_date: z.string().nullable(),
  id: z.uuid(),
  name: z.string(),
  start_date: z.string().nullable(),
  status: z.string(),
  updated_at: z.string(),
  visibility: z.string(),
  workspace_id: z.uuid(),
});
const projectMemberRowSchema = z.object({
  joined_at: z.string(),
  project_id: z.uuid(),
  role: z.string(),
  updated_at: z.string(),
  user_id: z.uuid(),
  workspace_id: z.uuid(),
  workspace_member: z.object({
    profile: z.object({
      avatar_url: z.string().nullable(),
      display_name: z.string(),
    }),
    role: z.string(),
  }),
});
const taskSchema = z.object({
  archived_at: z.string().nullable(),
  created_at: z.string(),
  created_by: z.uuid().nullable(),
  description: z.string().nullable(),
  due_at: z.string().nullable(),
  id: z.uuid(),
  position: z.coerce.number(),
  priority: z.string(),
  project_id: z.uuid(),
  status_id: z.uuid(),
  title: z.string(),
  updated_at: z.string(),
});
const taskAssigneeSchema = z.object({
  assigned_at: z.string(),
  assigned_by: z.uuid().nullable(),
  task_id: z.uuid(),
  user_id: z.uuid(),
});
const taskStatusSchema = z.object({
  category: z.string(),
  color: z.string(),
  created_at: z.string(),
  id: z.uuid(),
  name: z.string(),
  position: z.number(),
  project_id: z.uuid(),
  updated_at: z.string(),
});
const taskCommentSchema = z.object({
  author_id: z.uuid().nullable(),
  body: z.string(),
  created_at: z.string(),
  edited_at: z.string().nullable(),
  id: z.uuid(),
  task_id: z.uuid(),
  updated_at: z.string(),
});
const notificationSchema = z.object({
  actor_id: z.uuid().nullable(),
  body: z.string().nullable(),
  created_at: z.string(),
  event_key: z.string().nullable(),
  id: z.uuid(),
  payload: z.record(z.string(), z.unknown()),
  project_id: z.uuid().nullable(),
  read_at: z.string().nullable(),
  reminder_id: z.uuid().nullable(),
  scheduled_for: z.string().nullable(),
  task_id: z.uuid().nullable(),
  title: z.string(),
  type: z.string(),
  user_id: z.uuid(),
  workspace_id: z.uuid(),
});
const notificationEventTypeSchema = z.object({
  category: z.string(),
  code: z.string(),
  created_at: z.string(),
  default_email_enabled: z.boolean(),
  default_in_app_enabled: z.boolean(),
  default_push_enabled: z.boolean(),
  description: z.string(),
  display_name: z.string(),
  is_active: z.boolean(),
  updated_at: z.string(),
});
const notificationEventPreferenceSchema = z.object({
  created_at: z.string(),
  email_enabled: z.boolean(),
  event_type: z.string(),
  in_app_enabled: z.boolean(),
  push_enabled: z.boolean(),
  updated_at: z.string(),
  user_id: z.uuid(),
});
const notificationPlanEventSchema = z.object({
  created_at: z.string(),
  email_enabled: z.boolean(),
  event_type: z.string(),
  in_app_enabled: z.boolean(),
  push_enabled: z.boolean(),
  plan_code: z.string(),
  updated_at: z.string(),
});
const activitySchema = z.object({
  actor_id: z.uuid().nullable(),
  created_at: z.string(),
  entity_id: z.uuid().nullable(),
  entity_type: z.string(),
  event_type: z.string(),
  id: z.uuid(),
  metadata: z.record(z.string(), z.unknown()),
  project_id: z.uuid().nullable(),
  task_id: z.uuid().nullable(),
  workspace_id: z.uuid(),
});
const invitationSchema = z.object({
  accepted_at: z.string().nullable(),
  accepted_by: z.uuid().nullable(),
  created_at: z.string(),
  email: z.string(),
  expires_at: z.string(),
  id: z.uuid(),
  invited_by: z.uuid().nullable(),
  revoked_at: z.string().nullable(),
  role: z.string(),
  status: z.string(),
  updated_at: z.string(),
  workspace_id: z.uuid(),
});
const workspaceMemberRowSchema = z.object({
  joined_at: z.string(),
  profiles: z.object({
    avatar_url: z.string().nullable(),
    display_name: z.string(),
  }),
  role: z.string(),
  updated_at: z.string(),
  user_id: z.uuid(),
  workspace_id: z.uuid(),
});
const workspaceMembershipSchema = z.object({
  joined_at: z.string(),
  role: z.string(),
  updated_at: z.string(),
  user_id: z.uuid(),
  workspace_id: z.uuid(),
});
const notificationPreferencesSchema = z.object({
  created_at: z.string(),
  email_enabled: z.boolean(),
  in_app_enabled: z.boolean(),
  push_enabled: z.boolean(),
  reminder_enabled: z.boolean(),
  task_assigned_enabled: z.boolean(),
  task_created_enabled: z.boolean(),
  updated_at: z.string(),
  user_id: z.uuid(),
});
const userDeviceSchema = z.object({
  created_at: z.string(),
  device_name: z.string().nullable(),
  enabled: z.boolean(),
  id: z.uuid(),
  last_seen_at: z.string(),
  platform: z.enum(['android', 'ios']),
  push_token: z.string(),
  revoked_at: z.string().nullable(),
  user_id: z.uuid(),
});
const notificationDeliverySchema = z.object({
  attempt_count: z.number().int().nonnegative(),
  channel: z.string(),
  created_at: z.string(),
  delivered_at: z.string().nullable(),
  error_code: z.string().nullable(),
  error_message: z.string().nullable(),
  id: z.uuid(),
  max_attempts: z.number().int().positive(),
  next_attempt_at: z.string(),
  notification_id: z.uuid().nullable(),
  reminder_id: z.uuid().nullable(),
  scheduled_for: z.string(),
  status: z.string(),
  updated_at: z.string(),
  user_id: z.uuid(),
  workspace_id: z.uuid(),
});
const subscriptionPlanSchema = z.object({
  code: z.string(),
  description: z.string(),
  display_name: z.string(),
  email_enabled: z.boolean(),
  max_active_reminder_tasks: z.number().int().nonnegative(),
  max_recipients_per_reminder: z.number().int().nonnegative(),
  max_reminders_per_task: z.number().int().nonnegative(),
  max_scheduled_notifications: z.number().int().nonnegative(),
  min_schedule_interval_minutes: z.number().int().positive(),
  monthly_email_limit: z.number().int().nonnegative(),
  notification_retention_days: z.number().int().positive(),
});
const scheduledNotificationSchema = z.object({
  body: z.string().nullable(),
  created_at: z.string(),
  created_by: z.uuid(),
  email_enabled: z.boolean(),
  ends_at: z.string().nullable(),
  id: z.uuid(),
  in_app_enabled: z.boolean(),
  interval_unit: z.string().nullable(),
  interval_value: z.number().int().positive().nullable(),
  last_run_at: z.string().nullable(),
  next_run_at: z.string(),
  project_id: z.uuid().nullable(),
  schedule_kind: z.string(),
  status: z.string(),
  task_id: z.uuid().nullable(),
  timezone: z.string(),
  title: z.string(),
  updated_at: z.string(),
  workspace_id: z.uuid(),
});
const workspaceSubscriptionRowSchema = z.object({
  cancel_at_period_end: z.boolean(),
  current_period_end: z.string().nullable(),
  current_period_start: z.string().nullable(),
  plan_code: z.string(),
  provider: z.string(),
  status: z.string(),
  workspace_id: z.uuid(),
});
const taskReminderRowSchema = z.object({
  created_at: z.string(),
  created_by: z.uuid(),
  email_enabled: z.boolean(),
  ends_at: z.string().nullable(),
  id: z.uuid(),
  in_app_enabled: z.boolean(),
  last_run_at: z.string().nullable(),
  next_run_at: z.string(),
  project_id: z.uuid(),
  schedule_kind: z.string(),
  status: z.string(),
  stop_when_completed: z.boolean(),
  task_id: z.uuid(),
  timezone: z.string(),
  updated_at: z.string(),
  workspace_id: z.uuid(),
});
const reminderRecipientSchema = z.object({
  reminder_id: z.uuid(),
  user_id: z.uuid(),
});
const projectMemberSelect =
  'project_id,workspace_id,user_id,role,joined_at,updated_at,workspace_member:workspace_members!project_members_workspace_user_fk(role,profile:profiles!workspace_members_user_id_fkey(display_name,avatar_url))';

export interface InviteResult {
  invitation: Invitation;
  token: string;
}

export interface BoardnestDataService {
  acceptInvitation: (token: string) => Promise<WorkspaceMembership>;
  activityFeed: (
    workspaceId: string,
    projectId: string | null,
    pagination: Pagination,
  ) => Promise<Connection<ActivityLog>>;
  addComment: (
    taskId: string,
    body: string,
    userId: string,
  ) => Promise<TaskComment>;
  assignTask: (
    taskId: string,
    assigneeId: string,
    userId: string,
  ) => Promise<TaskAssignee>;
  createProject: (input: CreateProjectData, userId: string) => Promise<Project>;
  createScheduledNotification: (
    input: CreateScheduledNotificationData,
    userId: string,
  ) => Promise<ScheduledNotification>;
  createTask: (input: CreateTaskData, userId: string) => Promise<Task>;
  createTaskReminder: (input: CreateTaskReminderData) => Promise<TaskReminder>;
  createWorkspace: (
    name: string,
    slug: string,
    userId: string,
  ) => Promise<Workspace>;
  deleteProject: (id: string) => Promise<string>;
  deleteScheduledNotification: (id: string) => Promise<string>;
  deleteNotificationEventPreference: (
    userId: string,
    eventType: string,
  ) => Promise<string>;
  deleteTask: (id: string) => Promise<string>;
  deleteTaskReminder: (id: string) => Promise<string>;
  inviteMember: (
    workspaceId: string,
    email: string,
    role: string,
    userId: string,
  ) => Promise<InviteResult>;
  addProjectMember: (
    projectId: string,
    userId: string,
    role: string,
  ) => Promise<ProjectMember>;
  removeProjectMember: (projectId: string, userId: string) => Promise<string>;
  removeWorkspaceMember: (
    workspaceId: string,
    userId: string,
  ) => Promise<string>;
  revokeInvitation: (id: string) => Promise<Invitation>;
  markNotificationAsRead: (id: string, userId: string) => Promise<Notification>;
  moveTask: (id: string, statusId: string, position: number) => Promise<Task>;
  notification: (id: string) => Promise<Notification | null>;
  notificationEventPreferences: (
    userId: string,
  ) => Promise<NotificationEventPreference[]>;
  notificationEventTypes: () => Promise<NotificationEventType[]>;
  notificationDeliveries: (
    userId: string,
    workspaceId: string | null,
    pagination: Pagination,
  ) => Promise<Connection<NotificationDelivery>>;
  notificationPlanEvents: (
    workspaceId: string,
  ) => Promise<NotificationPlanEvent[]>;
  notificationPreferences: (userId: string) => Promise<NotificationPreferences>;
  pushDevices: () => Promise<UserDevice[]>;
  registerPushDevice: (
    platform: string,
    pushToken: string,
    deviceName: string | null,
  ) => Promise<UserDevice>;
  revokePushDevice: (id: string) => Promise<boolean>;
  unreadNotificationCount: (userId: string) => Promise<number>;
  notifications: (
    userId: string,
    unreadOnly: boolean,
    pagination: Pagination,
  ) => Promise<Connection<Notification>>;
  project: (id: string) => Promise<Project | null>;
  projectMembers: (
    projectId: string,
    pagination: Pagination,
  ) => Promise<Connection<ProjectMember>>;
  projects: (
    workspaceId: string,
    pagination: Pagination,
  ) => Promise<Connection<Project>>;
  scheduledNotification: (id: string) => Promise<ScheduledNotification | null>;
  scheduledNotifications: (
    workspaceId: string,
    projectId: string | null,
    taskId: string | null,
  ) => Promise<ScheduledNotification[]>;
  task: (id: string) => Promise<Task | null>;
  taskAssignees: (taskId: string) => Promise<TaskAssignee[]>;
  taskComments: (
    taskId: string,
    pagination: Pagination,
  ) => Promise<Connection<TaskComment>>;
  taskReminder: (id: string) => Promise<TaskReminder | null>;
  taskReminders: (taskId: string) => Promise<TaskReminder[]>;
  taskStatuses: (projectId: string) => Promise<TaskStatus[]>;
  tasks: (
    projectId: string,
    statusId: string | null,
    search: string | null,
    pagination: Pagination,
  ) => Promise<Connection<Task>>;
  updateProject: (id: string, input: UpdateProjectData) => Promise<Project>;
  updateScheduledNotification: (
    id: string,
    input: UpdateScheduledNotificationData,
  ) => Promise<ScheduledNotification>;
  updateProjectMemberRole: (
    projectId: string,
    userId: string,
    role: string,
  ) => Promise<ProjectMember>;
  updateNotificationPreferences: (
    userId: string,
    input: UpdateNotificationPreferencesData,
  ) => Promise<NotificationPreferences>;
  updateNotificationEventPreference: (
    userId: string,
    input: UpdateNotificationEventPreferenceData,
  ) => Promise<NotificationEventPreference>;
  updateTask: (id: string, input: UpdateTaskData) => Promise<Task>;
  unassignTask: (taskId: string, assigneeId: string) => Promise<string>;
  updateTaskReminder: (
    id: string,
    input: UpdateTaskReminderData,
  ) => Promise<TaskReminder>;
  updateTaskReminderStatus: (
    id: string,
    status: 'active' | 'paused',
  ) => Promise<TaskReminder>;
  updateWorkspace: (
    id: string,
    input: UpdateWorkspaceData,
  ) => Promise<Workspace>;
  replaceTaskReminderRecipients: (
    id: string,
    recipientIds: string[],
  ) => Promise<TaskReminder>;
  workspace: (id: string) => Promise<Workspace | null>;
  workspaceInvitations: (
    workspaceId: string,
    pagination: Pagination,
  ) => Promise<Connection<Invitation>>;
  workspaceMembers: (
    workspaceId: string,
    pagination: Pagination,
  ) => Promise<Connection<WorkspaceMember>>;
  workspaceSubscription: (
    workspaceId: string,
  ) => Promise<WorkspaceSubscription | null>;
  workspaces: (pagination: Pagination) => Promise<Connection<Workspace>>;
  updateWorkspaceMemberRole: (
    workspaceId: string,
    userId: string,
    role: string,
  ) => Promise<WorkspaceMember>;
}

export function createBoardnestDataService(
  supabaseUrl: string,
  publishableKey: string,
  accessToken: string,
): BoardnestDataService {
  const client = createClient(supabaseUrl, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });

  return new SupabaseBoardnestDataService(client);
}

class SupabaseBoardnestDataService implements BoardnestDataService {
  constructor(private readonly client: SupabaseClient) {}

  async acceptInvitation(token: string): Promise<WorkspaceMembership> {
    const response = await this.client
      .rpc('accept_workspace_invitation', { p_token: token })
      .single();
    return required(workspaceMembershipSchema, response);
  }

  async workspaces(pagination: Pagination): Promise<Connection<Workspace>> {
    const response = await this.client
      .from('workspaces')
      .select('*')
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit);
    return connection(workspaceSchema, response, pagination);
  }

  async workspace(id: string): Promise<Workspace | null> {
    const response = await this.client
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return optional(workspaceSchema, response);
  }

  async workspaceMembers(
    workspaceId: string,
    pagination: Pagination,
  ): Promise<Connection<WorkspaceMember>> {
    const response = await this.client
      .from('workspace_members')
      .select(
        'workspace_id,user_id,role,joined_at,updated_at,profiles!inner(display_name,avatar_url)',
      )
      .eq('workspace_id', workspaceId)
      .order('joined_at', { ascending: true })
      .range(pagination.offset, pagination.offset + pagination.limit);
    throwForError(response.error);
    const rows = z.array(workspaceMemberRowSchema).parse(response.data);
    return {
      nodes: rows.slice(0, pagination.limit).map(workspaceMember),
      pageInfo: {
        hasNextPage: rows.length > pagination.limit,
        limit: pagination.limit,
        offset: pagination.offset,
      },
    };
  }

  async workspaceInvitations(
    workspaceId: string,
    pagination: Pagination,
  ): Promise<Connection<Invitation>> {
    const response = await this.client
      .from('invitations')
      .select(
        'id,workspace_id,email,role,status,invited_by,accepted_by,expires_at,accepted_at,revoked_at,created_at,updated_at',
      )
      .eq('workspace_id', workspaceId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit);
    return connection(invitationSchema, response, pagination);
  }

  async updateWorkspaceMemberRole(
    workspaceId: string,
    userId: string,
    role: string,
  ): Promise<WorkspaceMember> {
    const response = await this.client
      .from('workspace_members')
      .update({ role })
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .select(
        'workspace_id,user_id,role,joined_at,updated_at,profiles!inner(display_name,avatar_url)',
      )
      .single();
    return workspaceMember(required(workspaceMemberRowSchema, response));
  }

  async removeWorkspaceMember(
    workspaceId: string,
    userId: string,
  ): Promise<string> {
    const response = await this.client
      .from('workspace_members')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .select('user_id')
      .single();
    throwForError(response.error);
    return z.object({ user_id: z.uuid() }).parse(response.data).user_id;
  }

  async createWorkspace(
    name: string,
    slug: string,
    userId: string,
  ): Promise<Workspace> {
    const id = randomUUID();
    const insertResponse = await this.client
      .from('workspaces')
      .insert({ created_by: userId, id, name, slug });
    throwForError(
      insertResponse.error,
      'This workspace URL slug already exists. Choose a unique slug by adding a word or number.',
    );

    const response = await this.client
      .from('workspaces')
      .select('*')
      .eq('id', id)
      .single();
    return required(workspaceSchema, response);
  }

  async updateWorkspace(
    id: string,
    input: UpdateWorkspaceData,
  ): Promise<Workspace> {
    const response = await this.client
      .from('workspaces')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    throwForError(
      response.error,
      'This workspace URL slug already exists. Choose a unique slug by adding a word or number.',
    );
    return workspaceSchema.parse(response.data);
  }

  async projects(
    workspaceId: string,
    pagination: Pagination,
  ): Promise<Connection<Project>> {
    const response = await this.client
      .from('projects')
      .select('*')
      .eq('workspace_id', workspaceId)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit);
    return connection(projectSchema, response, pagination);
  }

  async project(id: string): Promise<Project | null> {
    const response = await this.client
      .from('projects')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return optional(projectSchema, response);
  }

  async projectMembers(
    projectId: string,
    pagination: Pagination,
  ): Promise<Connection<ProjectMember>> {
    const response = await this.client
      .from('project_members')
      .select(projectMemberSelect)
      .eq('project_id', projectId)
      .order('joined_at', { ascending: true })
      .range(pagination.offset, pagination.offset + pagination.limit);
    throwForError(response.error);
    const rows = z.array(projectMemberRowSchema).parse(response.data);
    return {
      nodes: rows.slice(0, pagination.limit).map(projectMember),
      pageInfo: {
        hasNextPage: rows.length > pagination.limit,
        limit: pagination.limit,
        offset: pagination.offset,
      },
    };
  }

  async addProjectMember(
    projectId: string,
    userId: string,
    role: string,
  ): Promise<ProjectMember> {
    const project = await this.project(projectId);
    if (!project) {
      throw new GraphQLError('The requested resource was not found.', {
        extensions: { code: 'NOT_FOUND' },
      });
    }
    const response = await this.client
      .from('project_members')
      .insert({
        project_id: projectId,
        role,
        user_id: userId,
        workspace_id: project.workspace_id,
      })
      .select(projectMemberSelect)
      .single();
    return projectMember(required(projectMemberRowSchema, response));
  }

  async updateProjectMemberRole(
    projectId: string,
    userId: string,
    role: string,
  ): Promise<ProjectMember> {
    const response = await this.client
      .from('project_members')
      .update({ role })
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .select(projectMemberSelect)
      .single();
    return projectMember(required(projectMemberRowSchema, response));
  }

  async removeProjectMember(
    projectId: string,
    userId: string,
  ): Promise<string> {
    const response = await this.client
      .from('project_members')
      .delete()
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .select('user_id')
      .single();
    throwForError(response.error);
    return z.object({ user_id: z.uuid() }).parse(response.data).user_id;
  }

  async createProject(
    input: CreateProjectData,
    userId: string,
  ): Promise<Project> {
    const id = randomUUID();
    const insertResponse = await this.client
      .from('projects')
      .insert({ ...input, created_by: userId, id });
    throwForError(insertResponse.error);

    const response = await this.client
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    return required(projectSchema, response);
  }

  async updateProject(id: string, input: UpdateProjectData): Promise<Project> {
    const response = await this.client
      .from('projects')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    return required(projectSchema, response);
  }

  async deleteProject(id: string): Promise<string> {
    const response = await this.client
      .from('projects')
      .delete()
      .eq('id', id)
      .select('id')
      .single();
    return deletedId(response);
  }

  async tasks(
    projectId: string,
    statusId: string | null,
    search: string | null,
    pagination: Pagination,
  ): Promise<Connection<Task>> {
    let query = this.client
      .from('tasks')
      .select('*')
      .eq('project_id', projectId)
      .is('archived_at', null);
    if (statusId) query = query.eq('status_id', statusId);
    if (search)
      query = query.textSearch('title', search, { type: 'websearch' });
    const response = await query
      .order('position', { ascending: true })
      .order('id', { ascending: true })
      .range(pagination.offset, pagination.offset + pagination.limit);
    return connection(taskSchema, response, pagination);
  }

  async task(id: string): Promise<Task | null> {
    const response = await this.client
      .from('tasks')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return optional(taskSchema, response);
  }

  async taskAssignees(taskId: string): Promise<TaskAssignee[]> {
    const response = await this.client
      .from('task_assignees')
      .select('*')
      .eq('task_id', taskId)
      .order('assigned_at', { ascending: true });
    throwForError(response.error);
    return z.array(taskAssigneeSchema).parse(response.data);
  }

  async taskComments(
    taskId: string,
    pagination: Pagination,
  ): Promise<Connection<TaskComment>> {
    const response = await this.client
      .from('task_comments')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(pagination.offset, pagination.offset + pagination.limit);
    return connection(taskCommentSchema, response, pagination);
  }

  async taskStatuses(projectId: string): Promise<TaskStatus[]> {
    const response = await this.client
      .from('task_statuses')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true });
    throwForError(response.error);
    return z.array(taskStatusSchema).parse(response.data);
  }

  async createTask(input: CreateTaskData, userId: string): Promise<Task> {
    const response = await this.client
      .from('tasks')
      .insert({ ...input, created_by: userId })
      .select('*')
      .single();
    return required(taskSchema, response);
  }

  async taskReminders(taskId: string): Promise<TaskReminder[]> {
    const response = await this.client
      .from('task_reminders')
      .select('*')
      .eq('task_id', taskId)
      .order('created_at', { ascending: false });
    throwForError(response.error);
    const rows = z.array(taskReminderRowSchema).parse(response.data);
    return this.withReminderRecipients(rows);
  }

  async taskReminder(id: string): Promise<TaskReminder | null> {
    const response = await this.client
      .from('task_reminders')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    throwForError(response.error);
    if (response.data === null) return null;
    const [reminder] = await this.withReminderRecipients([
      taskReminderRowSchema.parse(response.data),
    ]);
    return reminder ?? null;
  }

  async createTaskReminder(
    input: CreateTaskReminderData,
  ): Promise<TaskReminder> {
    const response = await this.client
      .rpc('create_task_reminder_with_recipients', {
        p_email_enabled: input.email_enabled,
        p_ends_at: input.ends_at ?? null,
        p_in_app_enabled: input.in_app_enabled,
        p_next_run_at: input.next_run_at,
        p_recipient_ids: input.recipient_ids,
        p_schedule_kind: input.schedule_kind,
        p_stop_when_completed: input.stop_when_completed,
        p_task_id: input.task_id,
        p_timezone: input.timezone,
      })
      .single();
    const row = required(taskReminderRowSchema, response);
    const [reminder] = await this.withReminderRecipients([row]);
    if (!reminder) throw new Error('Created reminder was not returned.');
    return reminder;
  }

  async updateTaskReminder(
    id: string,
    input: UpdateTaskReminderData,
  ): Promise<TaskReminder> {
    const response = await this.client
      .from('task_reminders')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    const row = required(taskReminderRowSchema, response);
    const [reminder] = await this.withReminderRecipients([row]);
    if (!reminder) throw new Error('Updated reminder was not returned.');
    return reminder;
  }

  async updateTaskReminderStatus(
    id: string,
    status: 'active' | 'paused',
  ): Promise<TaskReminder> {
    const response = await this.client
      .from('task_reminders')
      .update({ status })
      .eq('id', id)
      .select('*')
      .single();
    const row = required(taskReminderRowSchema, response);
    const [reminder] = await this.withReminderRecipients([row]);
    if (!reminder) throw new Error('Updated reminder was not returned.');
    return reminder;
  }

  async replaceTaskReminderRecipients(
    id: string,
    recipientIds: string[],
  ): Promise<TaskReminder> {
    const response = await this.client.rpc('replace_task_reminder_recipients', {
      p_recipient_ids: recipientIds,
      p_reminder_id: id,
    });
    throwForError(response.error);
    const reminder = await this.taskReminder(id);
    if (!reminder) {
      throw new GraphQLError('The requested resource was not found.', {
        extensions: { code: 'NOT_FOUND' },
      });
    }
    return reminder;
  }

  async deleteTaskReminder(id: string): Promise<string> {
    const response = await this.client
      .from('task_reminders')
      .delete()
      .eq('id', id)
      .select('id')
      .single();
    return deletedId(response);
  }

  async scheduledNotifications(
    workspaceId: string,
    projectId: string | null,
    taskId: string | null,
  ): Promise<ScheduledNotification[]> {
    let query = this.client
      .from('scheduled_notifications')
      .select('*')
      .eq('workspace_id', workspaceId);
    if (projectId) query = query.eq('project_id', projectId);
    if (taskId) query = query.eq('task_id', taskId);
    const response = await query
      .order('next_run_at', { ascending: true })
      .order('id', { ascending: true });
    return list(scheduledNotificationSchema, response);
  }

  async scheduledNotification(
    id: string,
  ): Promise<ScheduledNotification | null> {
    const response = await this.client
      .from('scheduled_notifications')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return optional(scheduledNotificationSchema, response);
  }

  async createScheduledNotification(
    input: CreateScheduledNotificationData,
    userId: string,
  ): Promise<ScheduledNotification> {
    const response = await this.client
      .from('scheduled_notifications')
      .insert({ ...input, created_by: userId })
      .select('*')
      .single();
    return required(scheduledNotificationSchema, response);
  }

  async updateScheduledNotification(
    id: string,
    input: UpdateScheduledNotificationData,
  ): Promise<ScheduledNotification> {
    const response = await this.client
      .from('scheduled_notifications')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    return required(scheduledNotificationSchema, response);
  }

  async deleteScheduledNotification(id: string): Promise<string> {
    const response = await this.client
      .from('scheduled_notifications')
      .delete()
      .eq('id', id)
      .select('id')
      .single();
    return deletedId(response);
  }

  async notificationPreferences(
    userId: string,
  ): Promise<NotificationPreferences> {
    const response = await this.client
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();
    return required(notificationPreferencesSchema, response);
  }

  async pushDevices(): Promise<UserDevice[]> {
    const response = await this.client
      .from('user_devices')
      .select('*')
      .order('last_seen_at', { ascending: false });
    return list(userDeviceSchema, response);
  }

  async registerPushDevice(
    platform: string,
    pushToken: string,
    deviceName: string | null,
  ): Promise<UserDevice> {
    const response = await this.client.rpc('register_push_device', {
      p_device_name: deviceName,
      p_platform: platform,
      p_push_token: pushToken,
    });
    return required(userDeviceSchema, response);
  }

  async revokePushDevice(id: string): Promise<boolean> {
    const response = await this.client.rpc('revoke_push_device', {
      p_device_id: id,
    });
    if (response.error) throw response.error;
    return response.data === true;
  }

  async notificationEventTypes(): Promise<NotificationEventType[]> {
    const response = await this.client
      .from('notification_event_types')
      .select('*')
      .eq('is_active', true)
      .order('category')
      .order('code');
    return list(notificationEventTypeSchema, response);
  }

  async notificationDeliveries(
    userId: string,
    workspaceId: string | null,
    pagination: Pagination,
  ): Promise<Connection<NotificationDelivery>> {
    let query = this.client
      .from('notification_deliveries')
      .select('*')
      .eq('user_id', userId);
    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    const response = await query
      .order('created_at', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit);
    return connection(notificationDeliverySchema, response, pagination);
  }

  async deleteNotificationEventPreference(
    userId: string,
    eventType: string,
  ): Promise<string> {
    const response = await this.client
      .from('notification_event_preferences')
      .delete()
      .eq('user_id', userId)
      .eq('event_type', eventType)
      .select('*')
      .single();
    return required(notificationEventPreferenceSchema, response).event_type;
  }

  async notificationEventPreferences(
    userId: string,
  ): Promise<NotificationEventPreference[]> {
    const response = await this.client
      .from('notification_event_preferences')
      .select('*')
      .eq('user_id', userId)
      .order('event_type');
    return list(notificationEventPreferenceSchema, response);
  }

  async notificationPlanEvents(
    workspaceId: string,
  ): Promise<NotificationPlanEvent[]> {
    const subscription = await this.workspaceSubscription(workspaceId);
    if (subscription === null) return [];

    const response = await this.client
      .from('plan_notification_events')
      .select('*')
      .eq('plan_code', subscription.effective_plan_code)
      .order('event_type');
    return list(notificationPlanEventSchema, response);
  }

  async updateNotificationPreferences(
    userId: string,
    input: UpdateNotificationPreferencesData,
  ): Promise<NotificationPreferences> {
    const response = await this.client
      .from('notification_preferences')
      .update(input)
      .eq('user_id', userId)
      .select('*')
      .single();
    return required(notificationPreferencesSchema, response);
  }

  async updateNotificationEventPreference(
    userId: string,
    input: UpdateNotificationEventPreferenceData,
  ): Promise<NotificationEventPreference> {
    const response = await this.client
      .from('notification_event_preferences')
      .upsert(
        { ...input, user_id: userId },
        { onConflict: 'user_id,event_type' },
      )
      .select('*')
      .single();
    return required(notificationEventPreferenceSchema, response);
  }

  async workspaceSubscription(
    workspaceId: string,
  ): Promise<WorkspaceSubscription | null> {
    const subscriptionResponse = await this.client
      .from('workspace_subscriptions')
      .select('*')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    throwForError(subscriptionResponse.error);
    if (subscriptionResponse.data === null) return null;

    const subscription = workspaceSubscriptionRowSchema.parse(
      subscriptionResponse.data,
    );
    const effectivePlanCode =
      subscription.plan_code === 'guest' ||
      ['active', 'trialing'].includes(subscription.status)
        ? subscription.plan_code
        : 'free';
    const planResponse = await this.client
      .from('subscription_plans')
      .select('*')
      .eq('code', effectivePlanCode)
      .single();
    const plan: SubscriptionPlan = required(
      subscriptionPlanSchema,
      planResponse,
    );
    return {
      ...subscription,
      effective_plan_code: effectivePlanCode,
      plan,
    };
  }

  async updateTask(id: string, input: UpdateTaskData): Promise<Task> {
    const response = await this.client
      .from('tasks')
      .update(input)
      .eq('id', id)
      .select('*')
      .single();
    return required(taskSchema, response);
  }

  async moveTask(
    id: string,
    statusId: string,
    position: number,
  ): Promise<Task> {
    const response = await this.client
      .from('tasks')
      .update({ position, status_id: statusId })
      .eq('id', id)
      .select('*')
      .single();
    return required(taskSchema, response);
  }

  async deleteTask(id: string): Promise<string> {
    const response = await this.client
      .from('tasks')
      .delete()
      .eq('id', id)
      .select('id')
      .single();
    return deletedId(response);
  }

  async assignTask(
    taskId: string,
    assigneeId: string,
    userId: string,
  ): Promise<TaskAssignee> {
    const response = await this.client
      .from('task_assignees')
      .insert({ assigned_by: userId, task_id: taskId, user_id: assigneeId })
      .select('*')
      .single();
    return required(taskAssigneeSchema, response);
  }

  async unassignTask(taskId: string, assigneeId: string): Promise<string> {
    const response = await this.client
      .from('task_assignees')
      .delete()
      .eq('task_id', taskId)
      .eq('user_id', assigneeId)
      .select('user_id')
      .single();
    throwForError(response.error);
    return z.object({ user_id: z.uuid() }).parse(response.data).user_id;
  }

  async addComment(
    taskId: string,
    body: string,
    userId: string,
  ): Promise<TaskComment> {
    const response = await this.client
      .from('task_comments')
      .insert({ author_id: userId, body, task_id: taskId })
      .select('*')
      .single();
    return required(taskCommentSchema, response);
  }

  async notifications(
    userId: string,
    unreadOnly: boolean,
    pagination: Pagination,
  ): Promise<Connection<Notification>> {
    let query = this.client
      .from('notifications')
      .select('*')
      .eq('user_id', userId);
    if (unreadOnly) query = query.is('read_at', null);
    const response = await query
      .order('created_at', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit);
    return connection(notificationSchema, response, pagination);
  }

  async unreadNotificationCount(userId: string): Promise<number> {
    const response = await this.client
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .is('read_at', null);
    throwForError(response.error);
    return z.number().int().nonnegative().parse(response.count);
  }

  async notification(id: string): Promise<Notification | null> {
    const response = await this.client
      .from('notifications')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return optional(notificationSchema, response);
  }

  async markNotificationAsRead(
    id: string,
    userId: string,
  ): Promise<Notification> {
    const response = await this.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();
    return required(notificationSchema, response);
  }

  async activityFeed(
    workspaceId: string,
    projectId: string | null,
    pagination: Pagination,
  ): Promise<Connection<ActivityLog>> {
    let query = this.client
      .from('activity_logs')
      .select('*')
      .eq('workspace_id', workspaceId);
    if (projectId) query = query.eq('project_id', projectId);
    const response = await query
      .order('created_at', { ascending: false })
      .range(pagination.offset, pagination.offset + pagination.limit);
    return connection(activitySchema, response, pagination);
  }

  async inviteMember(
    workspaceId: string,
    email: string,
    role: string,
    userId: string,
  ): Promise<InviteResult> {
    const token = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const response = await this.client
      .from('invitations')
      .insert({
        email: email.trim().toLowerCase(),
        expires_at: expiresAt.toISOString(),
        invited_by: userId,
        role,
        status: 'pending',
        token_hash: tokenHash,
        workspace_id: workspaceId,
      })
      .select(
        'id,workspace_id,email,role,status,invited_by,accepted_by,expires_at,accepted_at,revoked_at,created_at,updated_at',
      )
      .single();
    throwForError(
      response.error,
      'A pending invitation already exists for this email in the workspace.',
    );
    return { invitation: invitationSchema.parse(response.data), token };
  }

  async revokeInvitation(id: string): Promise<Invitation> {
    const response = await this.client
      .from('invitations')
      .update({
        revoked_at: new Date().toISOString(),
        status: 'revoked',
      })
      .eq('id', id)
      .eq('status', 'pending')
      .select(
        'id,workspace_id,email,role,status,invited_by,accepted_by,expires_at,accepted_at,revoked_at,created_at,updated_at',
      )
      .single();
    return required(invitationSchema, response);
  }

  private async withReminderRecipients(
    rows: z.infer<typeof taskReminderRowSchema>[],
  ): Promise<TaskReminder[]> {
    if (rows.length === 0) return [];
    const response = await this.client
      .from('task_reminder_recipients')
      .select('reminder_id,user_id')
      .in(
        'reminder_id',
        rows.map((row) => row.id),
      );
    throwForError(response.error);
    const recipients = z.array(reminderRecipientSchema).parse(response.data);
    const recipientIdsByReminder = new Map<string, string[]>();
    for (const recipient of recipients) {
      const ids = recipientIdsByReminder.get(recipient.reminder_id) ?? [];
      ids.push(recipient.user_id);
      recipientIdsByReminder.set(recipient.reminder_id, ids);
    }
    return rows.map((row) => ({
      ...row,
      recipient_ids: [...(recipientIdsByReminder.get(row.id) ?? [])].sort(),
    }));
  }
}

function workspaceMember(
  row: z.infer<typeof workspaceMemberRowSchema>,
): WorkspaceMember {
  return {
    avatar_url: row.profiles.avatar_url,
    display_name: row.profiles.display_name,
    joined_at: row.joined_at,
    role: row.role,
    updated_at: row.updated_at,
    user_id: row.user_id,
    workspace_id: row.workspace_id,
  };
}

function projectMember(
  row: z.infer<typeof projectMemberRowSchema>,
): ProjectMember {
  return {
    avatar_url: row.workspace_member.profile.avatar_url,
    display_name: row.workspace_member.profile.display_name,
    joined_at: row.joined_at,
    project_id: row.project_id,
    role: row.role,
    updated_at: row.updated_at,
    user_id: row.user_id,
    workspace_id: row.workspace_id,
    workspace_role: row.workspace_member.role,
  };
}

interface DataResponse {
  data: unknown;
  error: { code?: string; message: string } | null;
}

function required<T>(schema: z.ZodType<T>, response: DataResponse): T {
  throwForError(response.error);
  return schema.parse(response.data);
}

function optional<T>(schema: z.ZodType<T>, response: DataResponse): T | null {
  throwForError(response.error);
  return response.data === null ? null : schema.parse(response.data);
}

function list<T>(schema: z.ZodType<T>, response: DataResponse): T[] {
  throwForError(response.error);
  return z.array(schema).parse(response.data);
}

function connection<T>(
  schema: z.ZodType<T>,
  response: DataResponse,
  pagination: Pagination,
): Connection<T> {
  throwForError(response.error);
  const rows = z.array(schema).parse(response.data);
  return {
    nodes: rows.slice(0, pagination.limit),
    pageInfo: {
      hasNextPage: rows.length > pagination.limit,
      limit: pagination.limit,
      offset: pagination.offset,
    },
  };
}

function deletedId(response: DataResponse): string {
  throwForError(response.error);
  return z.object({ id: z.uuid() }).parse(response.data).id;
}

function throwForError(
  error: DataResponse['error'],
  conflictMessage = 'A record with these values already exists.',
): void {
  if (!error) return;
  const code = error.code ?? '';
  if (code === '42501') {
    throw new GraphQLError('You do not have permission for this operation.', {
      extensions: { code: 'FORBIDDEN' },
    });
  }
  if (code === '23505') {
    throw new GraphQLError(conflictMessage, {
      extensions: { code: 'CONFLICT' },
    });
  }
  if (['22023', '22P02', '23503', '23514'].includes(code)) {
    throw new GraphQLError('The operation violates a data constraint.', {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
  if (
    code === 'P0001' &&
    (error.message.startsWith('Guest limit reached:') ||
      error.message.startsWith('Plan limit reached:') ||
      error.message.startsWith('Invitation ') ||
      error.message.startsWith(
        'Custom notifications are unavailable for the current plan',
      ) ||
      error.message.startsWith('In-app custom notifications are disabled') ||
      error.message.startsWith('Email custom notifications are disabled') ||
      /^The [a-z0-9_]+ plan requires a custom notification interval of at least [0-9]+ minute\(s\)$/.test(
        error.message,
      ) ||
      /^The [a-z0-9_]+ plan does not include email reminders$/.test(
        error.message,
      ))
  ) {
    throw new GraphQLError(error.message, {
      extensions: { code: 'BAD_USER_INPUT' },
    });
  }
  if (code === 'PGRST116') {
    throw new GraphQLError('The requested resource was not found.', {
      extensions: { code: 'NOT_FOUND' },
    });
  }
  throw new GraphQLError('The database operation failed.', {
    extensions: { code: 'INTERNAL_SERVER_ERROR' },
  });
}
