export interface PageInfo {
  hasNextPage: boolean;
  limit: number;
  offset: number;
}

export interface Connection<T> {
  nodes: T[];
  pageInfo: PageInfo;
}

export interface Workspace {
  archived_at: string | null;
  created_at: string;
  created_by: string | null;
  id: string;
  name: string;
  slug: string;
  updated_at: string;
}

export interface Project {
  archived_at: string | null;
  created_at: string;
  created_by: string | null;
  description: string | null;
  due_date: string | null;
  id: string;
  name: string;
  start_date: string | null;
  status: string;
  updated_at: string;
  visibility: string;
  workspace_id: string;
}

export interface ProjectMember {
  avatar_url: string | null;
  display_name: string;
  joined_at: string;
  project_id: string;
  role: string;
  updated_at: string;
  user_id: string;
  workspace_id: string;
  workspace_role: string;
}

export interface Task {
  archived_at: string | null;
  created_at: string;
  created_by: string | null;
  description: string | null;
  due_at: string | null;
  id: string;
  position: number;
  priority: string;
  project_id: string;
  status_id: string;
  title: string;
  updated_at: string;
}

export interface TaskStatus {
  category: string;
  color: string;
  created_at: string;
  id: string;
  name: string;
  position: number;
  project_id: string;
  updated_at: string;
}

export interface TaskAssignee {
  assigned_at: string;
  assigned_by: string | null;
  task_id: string;
  user_id: string;
}

export interface TaskComment {
  author_id: string | null;
  body: string;
  created_at: string;
  edited_at: string | null;
  id: string;
  task_id: string;
  updated_at: string;
}

export interface Notification {
  body: string | null;
  created_at: string;
  id: string;
  payload: Record<string, unknown>;
  project_id: string | null;
  read_at: string | null;
  reminder_id: string | null;
  scheduled_for: string | null;
  task_id: string | null;
  title: string;
  type: string;
  user_id: string;
  workspace_id: string;
}

export interface NotificationPreferences {
  created_at: string;
  email_enabled: boolean;
  in_app_enabled: boolean;
  reminder_enabled: boolean;
  task_assigned_enabled: boolean;
  task_created_enabled: boolean;
  updated_at: string;
  user_id: string;
}

export interface SubscriptionPlan {
  code: string;
  description: string;
  display_name: string;
  email_enabled: boolean;
  max_active_reminder_tasks: number;
  max_recipients_per_reminder: number;
  max_reminders_per_task: number;
  monthly_email_limit: number;
  notification_retention_days: number;
}

export interface WorkspaceSubscription {
  cancel_at_period_end: boolean;
  current_period_end: string | null;
  current_period_start: string | null;
  effective_plan_code: string;
  plan: SubscriptionPlan;
  plan_code: string;
  provider: string;
  status: string;
  workspace_id: string;
}

export interface TaskReminder {
  created_at: string;
  created_by: string;
  email_enabled: boolean;
  ends_at: string | null;
  id: string;
  in_app_enabled: boolean;
  last_run_at: string | null;
  next_run_at: string;
  project_id: string;
  recipient_ids: string[];
  schedule_kind: string;
  status: string;
  stop_when_completed: boolean;
  task_id: string;
  timezone: string;
  updated_at: string;
  workspace_id: string;
}

export interface ActivityLog {
  actor_id: string | null;
  created_at: string;
  entity_id: string | null;
  entity_type: string;
  event_type: string;
  id: string;
  metadata: Record<string, unknown>;
  project_id: string | null;
  task_id: string | null;
  workspace_id: string;
}

export interface Invitation {
  accepted_at: string | null;
  accepted_by: string | null;
  created_at: string;
  email: string;
  expires_at: string;
  id: string;
  invited_by: string | null;
  revoked_at: string | null;
  role: string;
  status: string;
  updated_at: string;
  workspace_id: string;
}

export interface WorkspaceMember {
  avatar_url: string | null;
  display_name: string;
  joined_at: string;
  role: string;
  updated_at: string;
  user_id: string;
  workspace_id: string;
}

export interface WorkspaceMembership {
  joined_at: string;
  role: string;
  updated_at: string;
  user_id: string;
  workspace_id: string;
}

export interface Pagination {
  limit: number;
  offset: number;
}

export interface CreateProjectData {
  description?: string | null;
  due_date?: string | null;
  name: string;
  start_date?: string | null;
  status?: string;
  visibility?: string;
  workspace_id: string;
}

export interface UpdateProjectData {
  archived_at?: string | null;
  description?: string | null;
  due_date?: string | null;
  name?: string;
  start_date?: string | null;
  status?: string;
  visibility?: string;
}

export interface CreateTaskData {
  description?: string | null;
  due_at?: string | null;
  position?: number;
  priority?: string;
  project_id: string;
  status_id: string;
  title: string;
}

export interface UpdateTaskData {
  archived_at?: string | null;
  description?: string | null;
  due_at?: string | null;
  priority?: string;
  title?: string;
}

export interface CreateTaskReminderData {
  email_enabled: boolean;
  ends_at?: string | null;
  in_app_enabled: boolean;
  next_run_at: string;
  recipient_ids: string[];
  schedule_kind: string;
  stop_when_completed: boolean;
  task_id: string;
  timezone: string;
}

export interface UpdateTaskReminderData {
  email_enabled?: boolean;
  ends_at?: string | null;
  in_app_enabled?: boolean;
  next_run_at?: string;
  schedule_kind?: string;
  stop_when_completed?: boolean;
  timezone?: string;
}

export interface UpdateNotificationPreferencesData {
  email_enabled?: boolean;
  in_app_enabled?: boolean;
  reminder_enabled?: boolean;
  task_assigned_enabled?: boolean;
  task_created_enabled?: boolean;
}
