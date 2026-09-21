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
  created_by: string;
  id: string;
  name: string;
  slug: string;
  updated_at: string;
}

export interface Project {
  archived_at: string | null;
  created_at: string;
  created_by: string;
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
  task_id: string | null;
  title: string;
  type: string;
  user_id: string;
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
