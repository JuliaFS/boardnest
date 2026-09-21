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
  dueDate: string | null;
  updatedAt: string;
}

export interface NotificationSummary {
  id: string;
  title: string;
  body: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface TaskSummary {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  priority: 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  dueAt: string | null;
  updatedAt: string;
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
      title
      description
      priority
      dueAt
      updatedAt
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
