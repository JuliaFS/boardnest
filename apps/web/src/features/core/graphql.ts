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

export type WorkspaceRole = 'ADMIN' | 'MEMBER' | 'OWNER' | 'VIEWER';
export type ProjectRole = 'MEMBER' | 'PROJECT_LEAD' | 'VIEWER';

export interface WorkspaceMemberSummary {
  workspaceId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: WorkspaceRole;
  joinedAt: string;
  updatedAt: string;
}

export interface InvitationSummary {
  id: string;
  workspaceId: string;
  email: string;
  role: Exclude<WorkspaceRole, 'OWNER'>;
  status: string;
  expiresAt: string;
  createdAt: string;
}

export interface InvitationAcceptanceSummary {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string;
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

export interface ProjectMemberSummary {
  projectId: string;
  workspaceId: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: ProjectRole;
  workspaceRole: WorkspaceRole;
  joinedAt: string;
  updatedAt: string;
}

export interface NotificationSummary {
  id: string;
  type: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  workspaceId: string;
  projectId: string | null;
  taskId: string | null;
  reminderId: string | null;
  scheduledFor: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface MarkNotificationAsReadData {
  markNotificationAsRead: Pick<NotificationSummary, 'id' | 'readAt'> & {
    __typename?: 'Notification';
  };
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

export interface WorkspaceMembersData {
  workspaceMembers: { nodes: WorkspaceMemberSummary[]; pageInfo: PageInfo };
}

export interface WorkspaceInvitationsData {
  workspaceInvitations: { nodes: InvitationSummary[]; pageInfo: PageInfo };
}

export interface ProjectsData {
  projects: { nodes: ProjectSummary[]; pageInfo: PageInfo };
}

export interface ProjectData {
  project: ProjectSummary | null;
}

export interface ProjectMembersData {
  projectMembers: { nodes: ProjectMemberSummary[]; pageInfo: PageInfo };
}

export interface WorkspaceData {
  workspace: WorkspaceSummary | null;
}

export interface NotificationsData {
  notifications: { nodes: NotificationSummary[]; pageInfo: PageInfo };
}

export interface UnreadNotificationCountData {
  unreadNotificationCount: number;
}

export interface ScheduledNotificationSummary {
  id: string;
  workspaceId: string;
  projectId: string | null;
  taskId: string | null;
  createdBy: string;
  title: string;
  body: string | null;
  scheduleKind: 'INTERVAL' | 'ONCE';
  intervalValue: number | null;
  intervalUnit: 'DAY' | 'HOUR' | 'MINUTE' | 'MONTH' | 'WEEK' | 'YEAR' | null;
  timezone: string;
  nextRunAt: string;
  endsAt: string | null;
  lastRunAt: string | null;
  inAppEnabled: boolean;
  emailEnabled: boolean;
  status: 'ACTIVE' | 'CANCELED' | 'COMPLETED' | 'PAUSED';
  createdAt: string;
  updatedAt: string;
}

export interface NotificationEventTypeSummary {
  code: string;
  displayName: string;
  description: string;
  category: string;
  defaultInAppEnabled: boolean;
  defaultEmailEnabled: boolean;
}

export interface NotificationEventPreferenceSummary {
  eventType: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

export interface NotificationPlanEventSummary {
  planCode: string;
  eventType: string;
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

export interface NotificationPreferencesSummary {
  inAppEnabled: boolean;
  emailEnabled: boolean;
}

export interface NotificationDeliverySummary {
  id: string;
  workspaceId: string;
  reminderId: string | null;
  notificationId: string | null;
  channel: string;
  status: 'CANCELED' | 'DELIVERED' | 'FAILED' | 'PENDING' | 'PROCESSING';
  scheduledFor: string;
  nextAttemptAt: string;
  attemptCount: number;
  maxAttempts: number;
  deliveredAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface WorkspaceSubscriptionSummary {
  effectivePlanCode: string;
  plan: {
    code: string;
    displayName: string;
    maxScheduledNotifications: number;
    minScheduleIntervalMinutes: number;
    monthlyEmailLimit: number;
    emailEnabled: boolean;
  };
}

export interface ScheduledNotificationsData {
  scheduledNotifications: ScheduledNotificationSummary[];
}

export interface NotificationSettingsData {
  notificationEventTypes: NotificationEventTypeSummary[];
  notificationEventPreferences: NotificationEventPreferenceSummary[];
  notificationPlanEvents: NotificationPlanEventSummary[];
  notificationPreferences: NotificationPreferencesSummary;
  workspaceSubscription: WorkspaceSubscriptionSummary | null;
}

export interface NotificationDeliveriesData {
  notificationDeliveries: {
    nodes: NotificationDeliverySummary[];
    pageInfo: PageInfo;
  };
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

export const WORKSPACE_MEMBERS_QUERY = gql`
  query WorkspaceMembers(
    $workspaceId: ID!
    $limit: Int = 100
    $offset: Int = 0
  ) {
    workspaceMembers(
      workspaceId: $workspaceId
      limit: $limit
      offset: $offset
    ) {
      nodes {
        workspaceId
        userId
        displayName
        avatarUrl
        role
        joinedAt
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

export const WORKSPACE_INVITATIONS_QUERY = gql`
  query WorkspaceInvitations(
    $workspaceId: ID!
    $limit: Int = 100
    $offset: Int = 0
  ) {
    workspaceInvitations(
      workspaceId: $workspaceId
      limit: $limit
      offset: $offset
    ) {
      nodes {
        id
        workspaceId
        email
        role
        status
        expiresAt
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

export const INVITE_MEMBER_MUTATION = gql`
  mutation InviteMember($input: InviteMemberInput!) {
    inviteMember(input: $input) {
      invitation {
        id
        workspaceId
        email
        role
        status
        expiresAt
        createdAt
      }
      token
      emailSent
    }
  }
`;

export const ACCEPT_INVITATION_MUTATION = gql`
  mutation AcceptInvitation($token: String!) {
    acceptInvitation(token: $token) {
      workspaceId
      userId
      role
      joinedAt
    }
  }
`;

export const UPDATE_WORKSPACE_MEMBER_ROLE_MUTATION = gql`
  mutation UpdateWorkspaceMemberRole(
    $workspaceId: ID!
    $userId: ID!
    $role: WorkspaceRole!
  ) {
    updateWorkspaceMemberRole(
      workspaceId: $workspaceId
      userId: $userId
      role: $role
    ) {
      workspaceId
      userId
      displayName
      avatarUrl
      role
      joinedAt
      updatedAt
    }
  }
`;

export const REMOVE_WORKSPACE_MEMBER_MUTATION = gql`
  mutation RemoveWorkspaceMember($workspaceId: ID!, $userId: ID!) {
    removeWorkspaceMember(workspaceId: $workspaceId, userId: $userId) {
      id
    }
  }
`;

export const REVOKE_INVITATION_MUTATION = gql`
  mutation RevokeInvitation($id: ID!) {
    revokeInvitation(id: $id) {
      id
      status
      revokedAt
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

export const PROJECT_MEMBERS_QUERY = gql`
  query ProjectMembers($projectId: ID!, $limit: Int = 100, $offset: Int = 0) {
    projectMembers(projectId: $projectId, limit: $limit, offset: $offset) {
      nodes {
        projectId
        workspaceId
        userId
        displayName
        avatarUrl
        role
        workspaceRole
        joinedAt
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

export const ADD_PROJECT_MEMBER_MUTATION = gql`
  mutation AddProjectMember(
    $projectId: ID!
    $userId: ID!
    $role: ProjectRole!
  ) {
    addProjectMember(projectId: $projectId, userId: $userId, role: $role) {
      projectId
      userId
      role
      workspaceRole
    }
  }
`;

export const UPDATE_PROJECT_MEMBER_ROLE_MUTATION = gql`
  mutation UpdateProjectMemberRole(
    $projectId: ID!
    $userId: ID!
    $role: ProjectRole!
  ) {
    updateProjectMemberRole(
      projectId: $projectId
      userId: $userId
      role: $role
    ) {
      projectId
      userId
      role
      workspaceRole
      updatedAt
    }
  }
`;

export const REMOVE_PROJECT_MEMBER_MUTATION = gql`
  mutation RemoveProjectMember($projectId: ID!, $userId: ID!) {
    removeProjectMember(projectId: $projectId, userId: $userId) {
      id
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
        type
        title
        body
        payload
        workspaceId
        projectId
        taskId
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

export const UNREAD_NOTIFICATION_COUNT_QUERY = gql`
  query UnreadNotificationCount {
    unreadNotificationCount
  }
`;

export const MARK_NOTIFICATION_AS_READ_MUTATION = gql`
  mutation MarkNotificationAsRead($id: ID!) {
    markNotificationAsRead(id: $id) {
      id
      readAt
    }
  }
`;

export const SCHEDULED_NOTIFICATIONS_QUERY = gql`
  query ScheduledNotifications($workspaceId: ID!) {
    scheduledNotifications(workspaceId: $workspaceId) {
      id
      workspaceId
      projectId
      taskId
      createdBy
      title
      body
      scheduleKind
      intervalValue
      intervalUnit
      timezone
      nextRunAt
      endsAt
      lastRunAt
      inAppEnabled
      emailEnabled
      status
      createdAt
      updatedAt
    }
  }
`;

export const NOTIFICATION_SETTINGS_QUERY = gql`
  query NotificationSettings($workspaceId: ID!) {
    notificationPreferences {
      inAppEnabled
      emailEnabled
    }
    notificationEventTypes {
      code
      displayName
      description
      category
      defaultInAppEnabled
      defaultEmailEnabled
    }
    notificationEventPreferences {
      eventType
      inAppEnabled
      emailEnabled
    }
    notificationPlanEvents(workspaceId: $workspaceId) {
      planCode
      eventType
      inAppEnabled
      emailEnabled
    }
    workspaceSubscription(workspaceId: $workspaceId) {
      effectivePlanCode
      plan {
        code
        displayName
        maxScheduledNotifications
        minScheduleIntervalMinutes
        monthlyEmailLimit
        emailEnabled
      }
    }
  }
`;

export const NOTIFICATION_DELIVERIES_QUERY = gql`
  query NotificationDeliveries($workspaceId: ID!, $limit: Int = 25) {
    notificationDeliveries(workspaceId: $workspaceId, limit: $limit) {
      nodes {
        id
        workspaceId
        reminderId
        notificationId
        channel
        status
        scheduledFor
        nextAttemptAt
        attemptCount
        maxAttempts
        deliveredAt
        errorCode
        errorMessage
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

const SCHEDULED_NOTIFICATION_FIELDS = gql`
  fragment ScheduledNotificationFields on ScheduledNotification {
    id
    workspaceId
    projectId
    taskId
    createdBy
    title
    body
    scheduleKind
    intervalValue
    intervalUnit
    timezone
    nextRunAt
    endsAt
    lastRunAt
    inAppEnabled
    emailEnabled
    status
    createdAt
    updatedAt
  }
`;

export const CREATE_SCHEDULED_NOTIFICATION_MUTATION = gql`
  mutation CreateScheduledNotification(
    $input: CreateScheduledNotificationInput!
  ) {
    createScheduledNotification(input: $input) {
      ...ScheduledNotificationFields
    }
  }
  ${SCHEDULED_NOTIFICATION_FIELDS}
`;

export const UPDATE_SCHEDULED_NOTIFICATION_MUTATION = gql`
  mutation UpdateScheduledNotification(
    $id: ID!
    $input: UpdateScheduledNotificationInput!
  ) {
    updateScheduledNotification(id: $id, input: $input) {
      ...ScheduledNotificationFields
    }
  }
  ${SCHEDULED_NOTIFICATION_FIELDS}
`;

export const PAUSE_SCHEDULED_NOTIFICATION_MUTATION = gql`
  mutation PauseScheduledNotification($id: ID!) {
    pauseScheduledNotification(id: $id) {
      ...ScheduledNotificationFields
    }
  }
  ${SCHEDULED_NOTIFICATION_FIELDS}
`;

export const RESUME_SCHEDULED_NOTIFICATION_MUTATION = gql`
  mutation ResumeScheduledNotification($id: ID!) {
    resumeScheduledNotification(id: $id) {
      ...ScheduledNotificationFields
    }
  }
  ${SCHEDULED_NOTIFICATION_FIELDS}
`;

export const DELETE_SCHEDULED_NOTIFICATION_MUTATION = gql`
  mutation DeleteScheduledNotification($id: ID!) {
    deleteScheduledNotification(id: $id) {
      id
    }
  }
`;

export const UPDATE_NOTIFICATION_EVENT_PREFERENCE_MUTATION = gql`
  mutation UpdateNotificationEventPreference(
    $input: UpdateNotificationEventPreferenceInput!
  ) {
    updateNotificationEventPreference(input: $input) {
      eventType
      inAppEnabled
      emailEnabled
    }
  }
`;

export const UPDATE_NOTIFICATION_PREFERENCES_MUTATION = gql`
  mutation UpdateNotificationPreferences(
    $input: UpdateNotificationPreferencesInput!
  ) {
    updateNotificationPreferences(input: $input) {
      inAppEnabled
      emailEnabled
    }
  }
`;
