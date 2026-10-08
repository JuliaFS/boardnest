import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { GraphQLError } from 'graphql';
import { z } from 'zod';

import type {
  ActivityLog,
  Connection,
  CreateProjectData,
  CreateTaskData,
  CreateTaskReminderData,
  Invitation,
  Notification,
  NotificationPreferences,
  Pagination,
  Project,
  SubscriptionPlan,
  Task,
  TaskAssignee,
  TaskComment,
  TaskReminder,
  TaskStatus,
  UpdateNotificationPreferencesData,
  UpdateProjectData,
  UpdateTaskData,
  UpdateTaskReminderData,
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
  body: z.string().nullable(),
  created_at: z.string(),
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
  reminder_enabled: z.boolean(),
  task_assigned_enabled: z.boolean(),
  task_created_enabled: z.boolean(),
  updated_at: z.string(),
  user_id: z.uuid(),
});
const subscriptionPlanSchema = z.object({
  code: z.string(),
  description: z.string(),
  display_name: z.string(),
  email_enabled: z.boolean(),
  max_active_reminder_tasks: z.number().int().nonnegative(),
  max_recipients_per_reminder: z.number().int().nonnegative(),
  max_reminders_per_task: z.number().int().nonnegative(),
  monthly_email_limit: z.number().int().nonnegative(),
  notification_retention_days: z.number().int().positive(),
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
  createTask: (input: CreateTaskData, userId: string) => Promise<Task>;
  createTaskReminder: (input: CreateTaskReminderData) => Promise<TaskReminder>;
  createWorkspace: (
    name: string,
    slug: string,
    userId: string,
  ) => Promise<Workspace>;
  deleteProject: (id: string) => Promise<string>;
  deleteTask: (id: string) => Promise<string>;
  deleteTaskReminder: (id: string) => Promise<string>;
  inviteMember: (
    workspaceId: string,
    email: string,
    role: string,
    userId: string,
  ) => Promise<InviteResult>;
  removeWorkspaceMember: (
    workspaceId: string,
    userId: string,
  ) => Promise<string>;
  revokeInvitation: (id: string) => Promise<Invitation>;
  markNotificationAsRead: (id: string) => Promise<Notification>;
  moveTask: (id: string, statusId: string, position: number) => Promise<Task>;
  notification: (id: string) => Promise<Notification | null>;
  notificationPreferences: (userId: string) => Promise<NotificationPreferences>;
  notifications: (
    userId: string,
    unreadOnly: boolean,
    pagination: Pagination,
  ) => Promise<Connection<Notification>>;
  project: (id: string) => Promise<Project | null>;
  projects: (
    workspaceId: string,
    pagination: Pagination,
  ) => Promise<Connection<Project>>;
  task: (id: string) => Promise<Task | null>;
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
  updateNotificationPreferences: (
    userId: string,
    input: UpdateNotificationPreferencesData,
  ) => Promise<NotificationPreferences>;
  updateTask: (id: string, input: UpdateTaskData) => Promise<Task>;
  updateTaskReminder: (
    id: string,
    input: UpdateTaskReminderData,
  ) => Promise<TaskReminder>;
  updateTaskReminderStatus: (
    id: string,
    status: 'active' | 'paused',
  ) => Promise<TaskReminder>;
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

  async notification(id: string): Promise<Notification | null> {
    const response = await this.client
      .from('notifications')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    return optional(notificationSchema, response);
  }

  async markNotificationAsRead(id: string): Promise<Notification> {
    const response = await this.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('id', id)
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
