import { gql } from '@apollo/client';

export interface PageInfo {
  hasNextPage: boolean;
  limit: number;
  offset: number;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  updatedAt: string;
}

export interface ProjectSummary {
  id: string;
  workspaceId: string;
  name: string;
  description: string | null;
  visibility: 'PRIVATE' | 'WORKSPACE';
  status: 'ACTIVE' | 'COMPLETED' | 'ON_HOLD' | 'PLANNED';
  startDate: string | null;
  dueDate: string | null;
  updatedAt: string;
}

export interface NotificationSummary {
  id: string;
  title: string;
  body: string | null;
  reminderId: string | null;
  scheduledFor: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface TaskSummary {
  id: string;
  projectId: string;
  statusId: string;
  title: string;
  description: string | null;
  priority: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  position: number;
  dueAt: string | null;
  updatedAt: string;
}

export interface TaskStatusSummary {
  id: string;
  projectId: string;
  name: string;
  category: 'done' | 'in_progress' | 'todo';
  color: string;
  position: number;
}

export interface WorkspacesData {
  workspaces: { nodes: WorkspaceSummary[]; pageInfo: PageInfo };
}

export interface ProjectsData {
  projects: { nodes: ProjectSummary[]; pageInfo: PageInfo };
}

export interface ProjectData {
  project: ProjectSummary | null;
}

export interface WorkspaceData {
  workspace: WorkspaceSummary | null;
}

export interface NotificationsData {
  notifications: { nodes: NotificationSummary[]; pageInfo: PageInfo };
}

export interface TaskData {
  task: TaskSummary | null;
}

export interface BoardData {
  taskStatuses: TaskStatusSummary[];
  tasks: { nodes: TaskSummary[]; pageInfo: PageInfo };
}

export interface TaskCreatedData {
  taskCreated: TaskSummary;
}

export interface TaskUpdatedData {
  taskUpdated: TaskSummary;
}

export interface TaskDeletedData {
  taskDeleted: { id: string };
}

export const WORKSPACES_QUERY = gql`
  query Workspaces($limit: Int = 25, $offset: Int = 0) {
    workspaces(limit: $limit, offset: $offset) {
      nodes {
        id
        name
        slug
        updatedAt
      }
      pageInfo {
        hasNextPage
        limit
        offset
      }
    }
  }
`;

export const WORKSPACE_QUERY = gql`
  query Workspace($id: ID!) {
    workspace(id: $id) {
      id
      name
      slug
      updatedAt
    }
  }
`;

export const PROJECTS_QUERY = gql`
  query Projects($workspaceId: ID!, $limit: Int = 25, $offset: Int = 0) {
    projects(workspaceId: $workspaceId, limit: $limit, offset: $offset) {
      nodes {
        id
        workspaceId
        name
        description
        visibility
        status
        startDate
        dueDate
        updatedAt
      }
      pageInfo {
        hasNextPage
        limit
        offset
      }
    }
  }
`;

export const PROJECT_QUERY = gql`
  query Project($id: ID!) {
    project(id: $id) {
      id
      workspaceId
      name
      description
      visibility
      status
      startDate
      dueDate
      updatedAt
    }
  }
`;

export const TASK_QUERY = gql`
  query Task($id: ID!) {
    task(id: $id) {
      id
      projectId
      statusId
      title
      description
      priority
      position
      dueAt
      updatedAt
    }
  }
`;

export const BOARD_QUERY = gql`
  query Board($projectId: ID!, $search: String) {
    taskStatuses(projectId: $projectId) {
      id
      projectId
      name
      category
      color
      position
    }
    tasks(projectId: $projectId, search: $search, limit: 100) {
      nodes {
        id
        projectId
        statusId
        title
        description
        priority
        position
        dueAt
        updatedAt
      }
      pageInfo {
        hasNextPage
        limit
        offset
      }
    }
  }
`;

export const CREATE_WORKSPACE_MUTATION = gql`
  mutation CreateWorkspace($input: CreateWorkspaceInput!) {
    createWorkspace(input: $input) {
      id
      name
      slug
      updatedAt
    }
  }
`;

export const CREATE_PROJECT_MUTATION = gql`
  mutation CreateProject($input: CreateProjectInput!) {
    createProject(input: $input) {
      id
      workspaceId
      name
      description
      visibility
      status
      startDate
      dueDate
      updatedAt
    }
  }
`;

export const UPDATE_PROJECT_MUTATION = gql`
  mutation UpdateProject($id: ID!, $input: UpdateProjectInput!) {
    updateProject(id: $id, input: $input) {
      id
      workspaceId
      name
      description
      visibility
      status
      startDate
      dueDate
      updatedAt
    }
  }
`;

export const DELETE_PROJECT_MUTATION = gql`
  mutation DeleteProject($id: ID!) {
    deleteProject(id: $id) {
      id
    }
  }
`;

export const CREATE_TASK_MUTATION = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      id
      projectId
      statusId
      title
      description
      priority
      position
      dueAt
      updatedAt
    }
  }
`;

export const UPDATE_TASK_MUTATION = gql`
  mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      id
      projectId
      statusId
      title
      description
      priority
      position
      dueAt
      updatedAt
    }
  }
`;

export const MOVE_TASK_MUTATION = gql`
  mutation MoveTask($id: ID!, $input: MoveTaskInput!) {
    moveTask(id: $id, input: $input) {
      id
      statusId
      position
      updatedAt
    }
  }
`;

export const DELETE_TASK_MUTATION = gql`
  mutation DeleteTask($id: ID!) {
    deleteTask(id: $id) {
      id
    }
  }
`;

export const TASK_CREATED_SUBSCRIPTION = gql`
  subscription TaskCreated($projectId: ID!) {
    taskCreated(projectId: $projectId) {
      id
      projectId
      statusId
      title
      description
      priority
      position
      dueAt
      updatedAt
    }
  }
`;

export const TASK_UPDATED_SUBSCRIPTION = gql`
  subscription TaskUpdated($projectId: ID!) {
    taskUpdated(projectId: $projectId) {
      id
      projectId
      statusId
      title
      description
      priority
      position
      dueAt
      updatedAt
    }
  }
`;

export const TASK_DELETED_SUBSCRIPTION = gql`
  subscription TaskDeleted($projectId: ID!) {
    taskDeleted(projectId: $projectId) {
      id
    }
  }
`;

export const NOTIFICATIONS_QUERY = gql`
  query Notifications($unreadOnly: Boolean = false) {
    notifications(unreadOnly: $unreadOnly) {
      nodes {
        id
        title
        body
        reminderId
        scheduledFor
        readAt
        createdAt
      }
      pageInfo {
        hasNextPage
        limit
        offset
      }
    }
  }
`;
