export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  JSON: { input: Record<string, unknown>; output: Record<string, unknown>; }
};

export type ActivityConnection = {
  __typename?: 'ActivityConnection';
  nodes: Array<ActivityLog>;
  pageInfo: PageInfo;
};

export type ActivityLog = {
  __typename?: 'ActivityLog';
  actorId?: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['String']['output'];
  entityId?: Maybe<Scalars['ID']['output']>;
  entityType: Scalars['String']['output'];
  eventType: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  metadata: Scalars['JSON']['output'];
  projectId?: Maybe<Scalars['ID']['output']>;
  taskId?: Maybe<Scalars['ID']['output']>;
  workspaceId: Scalars['ID']['output'];
};

export type CreateProjectInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  dueDate?: InputMaybe<Scalars['String']['input']>;
  name: Scalars['String']['input'];
  startDate?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<ProjectStatus>;
  visibility?: InputMaybe<ProjectVisibility>;
  workspaceId: Scalars['ID']['input'];
};

export type CreateScheduledNotificationInput = {
  body?: InputMaybe<Scalars['String']['input']>;
  emailEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  endsAt?: InputMaybe<Scalars['String']['input']>;
  inAppEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  intervalUnit?: InputMaybe<ScheduleIntervalUnit>;
  intervalValue?: InputMaybe<Scalars['Int']['input']>;
  nextRunAt: Scalars['String']['input'];
  projectId?: InputMaybe<Scalars['ID']['input']>;
  scheduleKind: ScheduledNotificationKind;
  taskId?: InputMaybe<Scalars['ID']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
  title: Scalars['String']['input'];
  workspaceId: Scalars['ID']['input'];
};

export type CreateTaskInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  dueAt?: InputMaybe<Scalars['String']['input']>;
  position?: InputMaybe<Scalars['Float']['input']>;
  priority?: InputMaybe<TaskPriority>;
  projectId: Scalars['ID']['input'];
  statusId: Scalars['ID']['input'];
  title: Scalars['String']['input'];
};

export type CreateTaskReminderInput = {
  emailEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  endsAt?: InputMaybe<Scalars['String']['input']>;
  inAppEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  nextRunAt: Scalars['String']['input'];
  recipientIds: Array<Scalars['ID']['input']>;
  scheduleKind: ReminderScheduleKind;
  stopWhenCompleted?: InputMaybe<Scalars['Boolean']['input']>;
  taskId: Scalars['ID']['input'];
  timezone?: InputMaybe<Scalars['String']['input']>;
};

export type CreateWorkspaceInput = {
  name: Scalars['String']['input'];
  slug: Scalars['String']['input'];
};

export type DeletePayload = {
  __typename?: 'DeletePayload';
  id: Scalars['ID']['output'];
};

export type Invitation = {
  __typename?: 'Invitation';
  acceptedAt?: Maybe<Scalars['String']['output']>;
  acceptedBy?: Maybe<Scalars['ID']['output']>;
  createdAt: Scalars['String']['output'];
  email: Scalars['String']['output'];
  expiresAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  invitedBy?: Maybe<Scalars['ID']['output']>;
  revokedAt?: Maybe<Scalars['String']['output']>;
  role: WorkspaceRole;
  status: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  workspaceId: Scalars['ID']['output'];
};

export type InvitationAcceptance = {
  __typename?: 'InvitationAcceptance';
  joinedAt: Scalars['String']['output'];
  role: WorkspaceRole;
  userId: Scalars['ID']['output'];
  workspaceId: Scalars['ID']['output'];
};

export type InvitationConnection = {
  __typename?: 'InvitationConnection';
  nodes: Array<Invitation>;
  pageInfo: PageInfo;
};

export type InvitationPayload = {
  __typename?: 'InvitationPayload';
  emailSent: Scalars['Boolean']['output'];
  invitation: Invitation;
  token?: Maybe<Scalars['String']['output']>;
};

export type InviteMemberInput = {
  email: Scalars['String']['input'];
  role?: InputMaybe<WorkspaceRole>;
  workspaceId: Scalars['ID']['input'];
};

export type MoveTaskInput = {
  position: Scalars['Float']['input'];
  statusId: Scalars['ID']['input'];
};

export type Mutation = {
  __typename?: 'Mutation';
  acceptInvitation: InvitationAcceptance;
  acceptInvitationById: InvitationAcceptance;
  addComment: TaskComment;
  addProjectMember: ProjectMember;
  assignTask: TaskAssignee;
  changeInvitationEmail: InvitationPayload;
  createProject: Project;
  createScheduledNotification: ScheduledNotification;
  createTask: Task;
  createTaskReminder: TaskReminder;
  createWorkspace: Workspace;
  deleteNotificationEventPreference: DeletePayload;
  deleteProject: DeletePayload;
  deleteScheduledNotification: DeletePayload;
  deleteTask: DeletePayload;
  deleteTaskReminder: DeletePayload;
  inviteMember: InvitationPayload;
  markNotificationAsRead: Notification;
  moveTask: Task;
  pauseScheduledNotification: ScheduledNotification;
  pauseTaskReminder: TaskReminder;
  registerPushDevice: UserDevice;
  removeProjectMember: DeletePayload;
  removeWorkspaceMember: DeletePayload;
  replaceTaskReminderRecipients: TaskReminder;
  resumeScheduledNotification: ScheduledNotification;
  resumeTaskReminder: TaskReminder;
  revokeInvitation: Invitation;
  revokePushDevice: DeletePayload;
  unassignTask: DeletePayload;
  updateNotificationEventPreference: NotificationEventPreference;
  updateNotificationPreferences: NotificationPreferences;
  updateProject: Project;
  updateProjectMemberRole: ProjectMember;
  updateScheduledNotification: ScheduledNotification;
  updateTask: Task;
  updateTaskReminder: TaskReminder;
  updateWorkspace: Workspace;
  updateWorkspaceMemberRole: WorkspaceMember;
};


export type MutationAcceptInvitationArgs = {
  token: Scalars['String']['input'];
};


export type MutationAcceptInvitationByIdArgs = {
  id: Scalars['ID']['input'];
};


export type MutationAddCommentArgs = {
  body: Scalars['String']['input'];
  taskId: Scalars['ID']['input'];
};


export type MutationAddProjectMemberArgs = {
  projectId: Scalars['ID']['input'];
  role: ProjectRole;
  userId: Scalars['ID']['input'];
};


export type MutationAssignTaskArgs = {
  assigneeId: Scalars['ID']['input'];
  taskId: Scalars['ID']['input'];
};


export type MutationChangeInvitationEmailArgs = {
  email: Scalars['String']['input'];
  id: Scalars['ID']['input'];
};


export type MutationCreateProjectArgs = {
  input: CreateProjectInput;
};


export type MutationCreateScheduledNotificationArgs = {
  input: CreateScheduledNotificationInput;
};


export type MutationCreateTaskArgs = {
  input: CreateTaskInput;
};


export type MutationCreateTaskReminderArgs = {
  input: CreateTaskReminderInput;
};


export type MutationCreateWorkspaceArgs = {
  input: CreateWorkspaceInput;
};


export type MutationDeleteNotificationEventPreferenceArgs = {
  eventType: Scalars['String']['input'];
};


export type MutationDeleteProjectArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteScheduledNotificationArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTaskArgs = {
  id: Scalars['ID']['input'];
};


export type MutationDeleteTaskReminderArgs = {
  id: Scalars['ID']['input'];
};


export type MutationInviteMemberArgs = {
  input: InviteMemberInput;
};


export type MutationMarkNotificationAsReadArgs = {
  id: Scalars['ID']['input'];
};


export type MutationMoveTaskArgs = {
  id: Scalars['ID']['input'];
  input: MoveTaskInput;
};


export type MutationPauseScheduledNotificationArgs = {
  id: Scalars['ID']['input'];
};


export type MutationPauseTaskReminderArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRegisterPushDeviceArgs = {
  input: RegisterPushDeviceInput;
};


export type MutationRemoveProjectMemberArgs = {
  projectId: Scalars['ID']['input'];
  userId: Scalars['ID']['input'];
};


export type MutationRemoveWorkspaceMemberArgs = {
  userId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};


export type MutationReplaceTaskReminderRecipientsArgs = {
  id: Scalars['ID']['input'];
  recipientIds: Array<Scalars['ID']['input']>;
};


export type MutationResumeScheduledNotificationArgs = {
  id: Scalars['ID']['input'];
};


export type MutationResumeTaskReminderArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRevokeInvitationArgs = {
  id: Scalars['ID']['input'];
};


export type MutationRevokePushDeviceArgs = {
  id: Scalars['ID']['input'];
};


export type MutationUnassignTaskArgs = {
  assigneeId: Scalars['ID']['input'];
  taskId: Scalars['ID']['input'];
};


export type MutationUpdateNotificationEventPreferenceArgs = {
  input: UpdateNotificationEventPreferenceInput;
};


export type MutationUpdateNotificationPreferencesArgs = {
  input: UpdateNotificationPreferencesInput;
};


export type MutationUpdateProjectArgs = {
  id: Scalars['ID']['input'];
  input: UpdateProjectInput;
};


export type MutationUpdateProjectMemberRoleArgs = {
  projectId: Scalars['ID']['input'];
  role: ProjectRole;
  userId: Scalars['ID']['input'];
};


export type MutationUpdateScheduledNotificationArgs = {
  id: Scalars['ID']['input'];
  input: UpdateScheduledNotificationInput;
};


export type MutationUpdateTaskArgs = {
  id: Scalars['ID']['input'];
  input: UpdateTaskInput;
};


export type MutationUpdateTaskReminderArgs = {
  id: Scalars['ID']['input'];
  input: UpdateTaskReminderInput;
};


export type MutationUpdateWorkspaceArgs = {
  id: Scalars['ID']['input'];
  input: UpdateWorkspaceInput;
};


export type MutationUpdateWorkspaceMemberRoleArgs = {
  role: WorkspaceRole;
  userId: Scalars['ID']['input'];
  workspaceId: Scalars['ID']['input'];
};

export type Notification = {
  __typename?: 'Notification';
  actorId?: Maybe<Scalars['ID']['output']>;
  body?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  eventKey?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  payload: Scalars['JSON']['output'];
  projectId?: Maybe<Scalars['ID']['output']>;
  readAt?: Maybe<Scalars['String']['output']>;
  reminderId?: Maybe<Scalars['ID']['output']>;
  scheduledFor?: Maybe<Scalars['String']['output']>;
  taskId?: Maybe<Scalars['ID']['output']>;
  title: Scalars['String']['output'];
  type: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
  workspaceId: Scalars['ID']['output'];
};

export type NotificationConnection = {
  __typename?: 'NotificationConnection';
  nodes: Array<Notification>;
  pageInfo: PageInfo;
};

export type NotificationDelivery = {
  __typename?: 'NotificationDelivery';
  attemptCount: Scalars['Int']['output'];
  channel: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  deliveredAt?: Maybe<Scalars['String']['output']>;
  errorCode?: Maybe<Scalars['String']['output']>;
  errorMessage?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  maxAttempts: Scalars['Int']['output'];
  nextAttemptAt: Scalars['String']['output'];
  notificationId?: Maybe<Scalars['ID']['output']>;
  reminderId?: Maybe<Scalars['ID']['output']>;
  scheduledFor: Scalars['String']['output'];
  status: NotificationDeliveryStatus;
  updatedAt: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
  workspaceId: Scalars['ID']['output'];
};

export type NotificationDeliveryConnection = {
  __typename?: 'NotificationDeliveryConnection';
  nodes: Array<NotificationDelivery>;
  pageInfo: PageInfo;
};

export type NotificationDeliveryStatus =
  | 'CANCELED'
  | 'DELIVERED'
  | 'FAILED'
  | 'PENDING'
  | 'PROCESSING'
  | 'SENT';

export type NotificationEventPreference = {
  __typename?: 'NotificationEventPreference';
  createdAt: Scalars['String']['output'];
  emailEnabled: Scalars['Boolean']['output'];
  eventType: Scalars['String']['output'];
  inAppEnabled: Scalars['Boolean']['output'];
  pushEnabled: Scalars['Boolean']['output'];
  updatedAt: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

export type NotificationEventType = {
  __typename?: 'NotificationEventType';
  category: Scalars['String']['output'];
  code: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  defaultEmailEnabled: Scalars['Boolean']['output'];
  defaultInAppEnabled: Scalars['Boolean']['output'];
  defaultPushEnabled: Scalars['Boolean']['output'];
  description: Scalars['String']['output'];
  displayName: Scalars['String']['output'];
  isActive: Scalars['Boolean']['output'];
  updatedAt: Scalars['String']['output'];
};

export type NotificationPlanEvent = {
  __typename?: 'NotificationPlanEvent';
  createdAt: Scalars['String']['output'];
  emailEnabled: Scalars['Boolean']['output'];
  eventType: Scalars['String']['output'];
  inAppEnabled: Scalars['Boolean']['output'];
  planCode: Scalars['String']['output'];
  pushEnabled: Scalars['Boolean']['output'];
  updatedAt: Scalars['String']['output'];
};

export type NotificationPreferences = {
  __typename?: 'NotificationPreferences';
  createdAt: Scalars['String']['output'];
  emailEnabled: Scalars['Boolean']['output'];
  inAppEnabled: Scalars['Boolean']['output'];
  pushEnabled: Scalars['Boolean']['output'];
  reminderEnabled: Scalars['Boolean']['output'];
  taskAssignedEnabled: Scalars['Boolean']['output'];
  taskCreatedEnabled: Scalars['Boolean']['output'];
  updatedAt: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
};

export type PageInfo = {
  __typename?: 'PageInfo';
  hasNextPage: Scalars['Boolean']['output'];
  limit: Scalars['Int']['output'];
  offset: Scalars['Int']['output'];
};

export type Project = {
  __typename?: 'Project';
  archivedAt?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  createdBy?: Maybe<Scalars['ID']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  dueDate?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  startDate?: Maybe<Scalars['String']['output']>;
  status: ProjectStatus;
  updatedAt: Scalars['String']['output'];
  visibility: ProjectVisibility;
  workspaceId: Scalars['ID']['output'];
};

export type ProjectConnection = {
  __typename?: 'ProjectConnection';
  nodes: Array<Project>;
  pageInfo: PageInfo;
};

export type ProjectMember = {
  __typename?: 'ProjectMember';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  joinedAt: Scalars['String']['output'];
  projectId: Scalars['ID']['output'];
  role: ProjectRole;
  updatedAt: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
  workspaceId: Scalars['ID']['output'];
  workspaceRole: WorkspaceRole;
};

export type ProjectMemberConnection = {
  __typename?: 'ProjectMemberConnection';
  nodes: Array<ProjectMember>;
  pageInfo: PageInfo;
};

export type ProjectRole =
  | 'MEMBER'
  | 'PROJECT_LEAD'
  | 'VIEWER';

export type ProjectStatus =
  | 'ACTIVE'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'PLANNED';

export type ProjectVisibility =
  | 'PRIVATE'
  | 'WORKSPACE';

export type Query = {
  __typename?: 'Query';
  activityFeed: ActivityConnection;
  currentUser?: Maybe<User>;
  notificationDeliveries: NotificationDeliveryConnection;
  notificationEventPreferences: Array<NotificationEventPreference>;
  notificationEventTypes: Array<NotificationEventType>;
  notificationPlanEvents: Array<NotificationPlanEvent>;
  notificationPreferences: NotificationPreferences;
  notifications: NotificationConnection;
  project?: Maybe<Project>;
  projectMembers: ProjectMemberConnection;
  projects: ProjectConnection;
  pushDevices: Array<UserDevice>;
  scheduledNotification?: Maybe<ScheduledNotification>;
  scheduledNotifications: Array<ScheduledNotification>;
  task?: Maybe<Task>;
  taskAssignees: Array<TaskAssignee>;
  taskComments: TaskCommentConnection;
  taskReminder?: Maybe<TaskReminder>;
  taskReminders: Array<TaskReminder>;
  taskStatuses: Array<TaskStatus>;
  tasks: TaskConnection;
  unreadNotificationCount: Scalars['Int']['output'];
  workspace?: Maybe<Workspace>;
  workspaceInvitations: InvitationConnection;
  workspaceMembers: WorkspaceMemberConnection;
  workspaceSubscription?: Maybe<WorkspaceSubscription>;
  workspaces: WorkspaceConnection;
};


export type QueryActivityFeedArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  projectId?: InputMaybe<Scalars['ID']['input']>;
  workspaceId: Scalars['ID']['input'];
};


export type QueryNotificationDeliveriesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  workspaceId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryNotificationPlanEventsArgs = {
  workspaceId: Scalars['ID']['input'];
};


export type QueryNotificationsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  unreadOnly?: InputMaybe<Scalars['Boolean']['input']>;
};


export type QueryProjectArgs = {
  id: Scalars['ID']['input'];
};


export type QueryProjectMembersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  projectId: Scalars['ID']['input'];
};


export type QueryProjectsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  workspaceId: Scalars['ID']['input'];
};


export type QueryScheduledNotificationArgs = {
  id: Scalars['ID']['input'];
};


export type QueryScheduledNotificationsArgs = {
  projectId?: InputMaybe<Scalars['ID']['input']>;
  taskId?: InputMaybe<Scalars['ID']['input']>;
  workspaceId: Scalars['ID']['input'];
};


export type QueryTaskArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTaskAssigneesArgs = {
  taskId: Scalars['ID']['input'];
};


export type QueryTaskCommentsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  taskId: Scalars['ID']['input'];
};


export type QueryTaskReminderArgs = {
  id: Scalars['ID']['input'];
};


export type QueryTaskRemindersArgs = {
  taskId: Scalars['ID']['input'];
};


export type QueryTaskStatusesArgs = {
  projectId: Scalars['ID']['input'];
};


export type QueryTasksArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  projectId: Scalars['ID']['input'];
  search?: InputMaybe<Scalars['String']['input']>;
  statusId?: InputMaybe<Scalars['ID']['input']>;
};


export type QueryWorkspaceArgs = {
  id: Scalars['ID']['input'];
};


export type QueryWorkspaceInvitationsArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  workspaceId: Scalars['ID']['input'];
};


export type QueryWorkspaceMembersArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  workspaceId: Scalars['ID']['input'];
};


export type QueryWorkspaceSubscriptionArgs = {
  workspaceId: Scalars['ID']['input'];
};


export type QueryWorkspacesArgs = {
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};

export type RealtimeSyncEvent = {
  __typename?: 'RealtimeSyncEvent';
  id: Scalars['ID']['output'];
  kind: Scalars['String']['output'];
  occurredAt: Scalars['String']['output'];
  projectId?: Maybe<Scalars['ID']['output']>;
  taskId?: Maybe<Scalars['ID']['output']>;
  workspaceId?: Maybe<Scalars['ID']['output']>;
};

export type RegisterPushDeviceInput = {
  deviceName?: InputMaybe<Scalars['String']['input']>;
  platform: Scalars['String']['input'];
  pushToken: Scalars['String']['input'];
};

export type ReminderScheduleKind =
  | 'MONTHLY'
  | 'ONCE'
  | 'QUARTERLY'
  | 'WEEKLY'
  | 'YEARLY';

export type ReminderStatus =
  | 'ACTIVE'
  | 'CANCELED'
  | 'COMPLETED'
  | 'PAUSED';

export type ScheduleIntervalUnit =
  | 'DAY'
  | 'HOUR'
  | 'MINUTE'
  | 'MONTH'
  | 'WEEK'
  | 'YEAR';

export type ScheduledNotification = {
  __typename?: 'ScheduledNotification';
  body?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  createdBy: Scalars['ID']['output'];
  emailEnabled: Scalars['Boolean']['output'];
  endsAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  inAppEnabled: Scalars['Boolean']['output'];
  intervalUnit?: Maybe<ScheduleIntervalUnit>;
  intervalValue?: Maybe<Scalars['Int']['output']>;
  lastRunAt?: Maybe<Scalars['String']['output']>;
  nextRunAt: Scalars['String']['output'];
  projectId?: Maybe<Scalars['ID']['output']>;
  scheduleKind: ScheduledNotificationKind;
  status: ScheduledNotificationStatus;
  taskId?: Maybe<Scalars['ID']['output']>;
  timezone: Scalars['String']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  workspaceId: Scalars['ID']['output'];
};

export type ScheduledNotificationKind =
  | 'INTERVAL'
  | 'ONCE';

export type ScheduledNotificationStatus =
  | 'ACTIVE'
  | 'CANCELED'
  | 'COMPLETED'
  | 'PAUSED';

export type Subscription = {
  __typename?: 'Subscription';
  projectMembershipChanged: RealtimeSyncEvent;
  taskCommentChanged: RealtimeSyncEvent;
  taskCreated: Task;
  taskDeleted: DeletePayload;
  taskUpdated: Task;
  workspaceMembershipChanged: RealtimeSyncEvent;
};


export type SubscriptionProjectMembershipChangedArgs = {
  projectId: Scalars['ID']['input'];
};


export type SubscriptionTaskCommentChangedArgs = {
  projectId: Scalars['ID']['input'];
};


export type SubscriptionTaskCreatedArgs = {
  projectId: Scalars['ID']['input'];
};


export type SubscriptionTaskDeletedArgs = {
  projectId: Scalars['ID']['input'];
};


export type SubscriptionTaskUpdatedArgs = {
  projectId: Scalars['ID']['input'];
};


export type SubscriptionWorkspaceMembershipChangedArgs = {
  workspaceId: Scalars['ID']['input'];
};

export type SubscriptionPlan = {
  __typename?: 'SubscriptionPlan';
  code: Scalars['String']['output'];
  description: Scalars['String']['output'];
  displayName: Scalars['String']['output'];
  emailEnabled: Scalars['Boolean']['output'];
  maxActiveReminderTasks: Scalars['Int']['output'];
  maxRecipientsPerReminder: Scalars['Int']['output'];
  maxRemindersPerTask: Scalars['Int']['output'];
  maxScheduledNotifications: Scalars['Int']['output'];
  minScheduleIntervalMinutes: Scalars['Int']['output'];
  monthlyEmailLimit: Scalars['Int']['output'];
  notificationRetentionDays: Scalars['Int']['output'];
};

export type Task = {
  __typename?: 'Task';
  archivedAt?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  createdBy?: Maybe<Scalars['ID']['output']>;
  description?: Maybe<Scalars['String']['output']>;
  dueAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  position: Scalars['Float']['output'];
  priority: TaskPriority;
  projectId: Scalars['ID']['output'];
  statusId: Scalars['ID']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type TaskAssignee = {
  __typename?: 'TaskAssignee';
  assignedAt: Scalars['String']['output'];
  assignedBy?: Maybe<Scalars['ID']['output']>;
  taskId: Scalars['ID']['output'];
  userId: Scalars['ID']['output'];
};

export type TaskComment = {
  __typename?: 'TaskComment';
  authorId?: Maybe<Scalars['ID']['output']>;
  body: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  editedAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  taskId: Scalars['ID']['output'];
  updatedAt: Scalars['String']['output'];
};

export type TaskCommentConnection = {
  __typename?: 'TaskCommentConnection';
  nodes: Array<TaskComment>;
  pageInfo: PageInfo;
};

export type TaskConnection = {
  __typename?: 'TaskConnection';
  nodes: Array<Task>;
  pageInfo: PageInfo;
};

export type TaskPriority =
  | 'HIGH'
  | 'LOW'
  | 'MEDIUM'
  | 'NONE'
  | 'URGENT';

export type TaskReminder = {
  __typename?: 'TaskReminder';
  createdAt: Scalars['String']['output'];
  createdBy: Scalars['ID']['output'];
  emailEnabled: Scalars['Boolean']['output'];
  endsAt?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  inAppEnabled: Scalars['Boolean']['output'];
  lastRunAt?: Maybe<Scalars['String']['output']>;
  nextRunAt: Scalars['String']['output'];
  projectId: Scalars['ID']['output'];
  recipientIds: Array<Scalars['ID']['output']>;
  scheduleKind: ReminderScheduleKind;
  status: ReminderStatus;
  stopWhenCompleted: Scalars['Boolean']['output'];
  taskId: Scalars['ID']['output'];
  timezone: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
  workspaceId: Scalars['ID']['output'];
};

export type TaskStatus = {
  __typename?: 'TaskStatus';
  category: Scalars['String']['output'];
  color: Scalars['String']['output'];
  createdAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  position: Scalars['Int']['output'];
  projectId: Scalars['ID']['output'];
  updatedAt: Scalars['String']['output'];
};

export type UpdateNotificationEventPreferenceInput = {
  emailEnabled: Scalars['Boolean']['input'];
  eventType: Scalars['String']['input'];
  inAppEnabled: Scalars['Boolean']['input'];
  pushEnabled: Scalars['Boolean']['input'];
};

export type UpdateNotificationPreferencesInput = {
  emailEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  inAppEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  pushEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  reminderEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  taskAssignedEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  taskCreatedEnabled?: InputMaybe<Scalars['Boolean']['input']>;
};

export type UpdateProjectInput = {
  archivedAt?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  dueDate?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  startDate?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<ProjectStatus>;
  visibility?: InputMaybe<ProjectVisibility>;
};

export type UpdateScheduledNotificationInput = {
  body?: InputMaybe<Scalars['String']['input']>;
  emailEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  endsAt?: InputMaybe<Scalars['String']['input']>;
  inAppEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  intervalUnit?: InputMaybe<ScheduleIntervalUnit>;
  intervalValue?: InputMaybe<Scalars['Int']['input']>;
  nextRunAt?: InputMaybe<Scalars['String']['input']>;
  projectId?: InputMaybe<Scalars['ID']['input']>;
  scheduleKind?: InputMaybe<ScheduledNotificationKind>;
  taskId?: InputMaybe<Scalars['ID']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTaskInput = {
  archivedAt?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  dueAt?: InputMaybe<Scalars['String']['input']>;
  priority?: InputMaybe<TaskPriority>;
  title?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateTaskReminderInput = {
  emailEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  endsAt?: InputMaybe<Scalars['String']['input']>;
  inAppEnabled?: InputMaybe<Scalars['Boolean']['input']>;
  nextRunAt?: InputMaybe<Scalars['String']['input']>;
  scheduleKind?: InputMaybe<ReminderScheduleKind>;
  stopWhenCompleted?: InputMaybe<Scalars['Boolean']['input']>;
  timezone?: InputMaybe<Scalars['String']['input']>;
};

export type UpdateWorkspaceInput = {
  name?: InputMaybe<Scalars['String']['input']>;
  slug?: InputMaybe<Scalars['String']['input']>;
};

export type User = {
  __typename?: 'User';
  displayName?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  id: Scalars['ID']['output'];
  isAnonymous: Scalars['Boolean']['output'];
  role: Scalars['String']['output'];
};

export type UserDevice = {
  __typename?: 'UserDevice';
  createdAt: Scalars['String']['output'];
  deviceName?: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  id: Scalars['ID']['output'];
  lastSeenAt: Scalars['String']['output'];
  platform: Scalars['String']['output'];
  pushToken: Scalars['String']['output'];
  revokedAt?: Maybe<Scalars['String']['output']>;
  userId: Scalars['ID']['output'];
};

export type Workspace = {
  __typename?: 'Workspace';
  archivedAt?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['String']['output'];
  createdBy?: Maybe<Scalars['ID']['output']>;
  id: Scalars['ID']['output'];
  name: Scalars['String']['output'];
  slug: Scalars['String']['output'];
  updatedAt: Scalars['String']['output'];
};

export type WorkspaceConnection = {
  __typename?: 'WorkspaceConnection';
  nodes: Array<Workspace>;
  pageInfo: PageInfo;
};

export type WorkspaceMember = {
  __typename?: 'WorkspaceMember';
  avatarUrl?: Maybe<Scalars['String']['output']>;
  displayName: Scalars['String']['output'];
  joinedAt: Scalars['String']['output'];
  role: WorkspaceRole;
  updatedAt: Scalars['String']['output'];
  userId: Scalars['ID']['output'];
  workspaceId: Scalars['ID']['output'];
};

export type WorkspaceMemberConnection = {
  __typename?: 'WorkspaceMemberConnection';
  nodes: Array<WorkspaceMember>;
  pageInfo: PageInfo;
};

export type WorkspaceRole =
  | 'ADMIN'
  | 'MEMBER'
  | 'OWNER'
  | 'VIEWER';

export type WorkspaceSubscription = {
  __typename?: 'WorkspaceSubscription';
  cancelAtPeriodEnd: Scalars['Boolean']['output'];
  currentPeriodEnd?: Maybe<Scalars['String']['output']>;
  currentPeriodStart?: Maybe<Scalars['String']['output']>;
  effectivePlanCode: Scalars['String']['output'];
  plan: SubscriptionPlan;
  planCode: Scalars['String']['output'];
  provider: Scalars['String']['output'];
  status: Scalars['String']['output'];
  workspaceId: Scalars['ID']['output'];
};
