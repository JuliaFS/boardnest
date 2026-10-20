import { useMutation, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { useNavigate } from 'react-router';

import { useAuth } from '../auth/AuthProvider';
import {
  DELETE_SCHEDULED_NOTIFICATION_MUTATION,
  MARK_NOTIFICATION_AS_READ_MUTATION,
  NOTIFICATION_DELIVERIES_QUERY,
  NOTIFICATION_SETTINGS_QUERY,
  NOTIFICATIONS_QUERY,
  PAUSE_SCHEDULED_NOTIFICATION_MUTATION,
  PROJECTS_QUERY,
  RESUME_SCHEDULED_NOTIFICATION_MUTATION,
  SCHEDULED_NOTIFICATIONS_QUERY,
  UPDATE_NOTIFICATION_EVENT_PREFERENCE_MUTATION,
  UPDATE_NOTIFICATION_PREFERENCES_MUTATION,
  WORKSPACES_QUERY,
  type NotificationDeliveriesData,
  type NotificationEventPreferenceSummary,
  type MarkNotificationAsReadData,
  type NotificationSettingsData,
  type NotificationSummary,
  type NotificationsData,
  type ProjectsData,
  type ScheduledNotificationSummary,
  type ScheduledNotificationsData,
  type WorkspacesData,
} from '../core/graphql';
import {
  primaryButtonClassName,
  secondaryButtonClassName,
} from '../core/form-styles';
import { Modal } from '../core/Modal';
import { PageHeader } from '../core/PageHeader';
import { EmptyState, PageSkeleton, QueryError } from '../core/QueryState';
import {
  notificationMutationMessage,
  notificationRoute,
} from './notification-schemas';
import { ScheduledNotificationForm } from './ScheduledNotificationForm';

type NotificationTab = 'deliveries' | 'inbox' | 'preferences' | 'schedules';

export function NotificationsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<NotificationTab>('inbox');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [editingSchedule, setEditingSchedule] =
    useState<ScheduledNotificationSummary | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const workspaces = useQuery<WorkspacesData>(WORKSPACES_QUERY);
  const workspaceNodes = workspaces.data?.workspaces.nodes ?? [];
  const workspaceId =
    workspaceNodes.find(({ id }) => id === selectedWorkspaceId)?.id ??
    workspaceNodes[0]?.id ??
    '';
  const projects = useQuery<ProjectsData>(PROJECTS_QUERY, {
    skip: !workspaceId,
    variables: { workspaceId },
  });
  const inbox = useQuery<NotificationsData>(NOTIFICATIONS_QUERY, {
    variables: { unreadOnly: false },
  });
  const schedules = useQuery<ScheduledNotificationsData>(
    SCHEDULED_NOTIFICATIONS_QUERY,
    { skip: !workspaceId, variables: { workspaceId } },
  );
  const settings = useQuery<NotificationSettingsData>(
    NOTIFICATION_SETTINGS_QUERY,
    { skip: !workspaceId, variables: { workspaceId } },
  );
  const deliveries = useQuery<NotificationDeliveriesData>(
    NOTIFICATION_DELIVERIES_QUERY,
    { skip: !workspaceId, variables: { workspaceId } },
  );
  const [pauseSchedule] = useMutation(PAUSE_SCHEDULED_NOTIFICATION_MUTATION);
  const [resumeSchedule] = useMutation(RESUME_SCHEDULED_NOTIFICATION_MUTATION);
  const [deleteSchedule] = useMutation(DELETE_SCHEDULED_NOTIFICATION_MUTATION);

  if (workspaces.loading) return <PageSkeleton />;
  if (workspaces.error) {
    return (
      <QueryError
        message={workspaces.error.message}
        onRetry={() => void workspaces.refetch()}
      />
    );
  }

  const plan = settings.data?.workspaceSubscription?.plan;
  const activeScheduleCount =
    schedules.data?.scheduledNotifications.filter(
      ({ status }) => status === 'ACTIVE',
    ).length ?? 0;

  async function runScheduleAction(
    action: 'delete' | 'pause' | 'resume',
    schedule: ScheduledNotificationSummary,
  ) {
    if (
      action === 'delete' &&
      !window.confirm(`Delete “${schedule.title}” permanently?`)
    ) {
      return;
    }
    setActionError(null);
    try {
      const mutation =
        action === 'pause'
          ? pauseSchedule
          : action === 'resume'
            ? resumeSchedule
            : deleteSchedule;
      await mutation({ variables: { id: schedule.id } });
      await schedules.refetch();
    } catch (error) {
      setActionError(notificationMutationMessage(error));
    }
  }

  return (
    <>
      <PageHeader
        actions={
          <div className="flex flex-wrap items-end gap-3">
            {workspaceNodes.length ? (
              <label className="grid gap-1 text-xs font-semibold text-slate-400">
                Workspace
                <select
                  className="min-w-56 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  onChange={(event) => {
                    setSelectedWorkspaceId(event.target.value);
                    setEditingSchedule(null);
                    setFormOpen(false);
                    setActionError(null);
                  }}
                  value={workspaceId}
                >
                  {workspaceNodes.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {workspaceId ? (
              <button
                className={primaryButtonClassName}
                disabled={!plan || projects.loading}
                onClick={() => {
                  setEditingSchedule(null);
                  setFormOpen(true);
                }}
                title={
                  !plan || projects.loading
                    ? 'Notification settings are still loading.'
                    : undefined
                }
                type="button"
              >
                New notification
              </button>
            ) : null}
          </div>
        }
        description="Read updates, manage personal schedules, delivery channels, and email status."
        eyebrow="Inbox"
        title="Notifications"
      />

      <div
        aria-label="Notification sections"
        className="mb-6 flex flex-wrap gap-2 border-b border-slate-800 pb-3"
        role="tablist"
      >
        {(
          [
            ['inbox', 'Inbox'],
            ['schedules', 'Schedules'],
            ['preferences', 'Preferences'],
            ['deliveries', 'Email delivery'],
          ] as const
        ).map(([value, label]) => (
          <button
            aria-selected={activeTab === value}
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              activeTab === value
                ? 'bg-indigo-400/15 text-indigo-200'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`}
            key={value}
            onClick={() => setActiveTab(value)}
            role="tab"
            type="button"
          >
            {label}
          </button>
        ))}
      </div>

      {!workspaceId ? (
        <EmptyState
          description="Create a workspace before configuring notification schedules."
          title="No workspace available"
        />
      ) : activeTab === 'inbox' ? (
        <InboxPanel
          data={inbox.data}
          error={inbox.error}
          loading={inbox.loading}
          onRetry={() => void inbox.refetch()}
        />
      ) : activeTab === 'schedules' ? (
        schedules.loading || projects.loading || settings.loading ? (
          <PageSkeleton />
        ) : schedules.error || projects.error || settings.error ? (
          <QueryError
            message={
              schedules.error?.message ??
              projects.error?.message ??
              settings.error?.message ??
              'Notification settings could not be loaded.'
            }
            onRetry={() => {
              void schedules.refetch();
              void projects.refetch();
              void settings.refetch();
            }}
          />
        ) : (
          <SchedulesPanel
            actionError={actionError}
            activeCount={activeScheduleCount}
            limit={plan?.maxScheduledNotifications ?? 0}
            onAction={(action, schedule) =>
              void runScheduleAction(action, schedule)
            }
            onCreate={() => {
              setEditingSchedule(null);
              setFormOpen(true);
            }}
            onEdit={(schedule) => {
              setEditingSchedule(schedule);
              setFormOpen(true);
            }}
            planName={plan?.displayName ?? 'Current'}
            schedules={schedules.data?.scheduledNotifications ?? []}
          />
        )
      ) : activeTab === 'preferences' ? (
        <PreferencesPanel
          data={settings.data}
          error={settings.error}
          loading={settings.loading}
          onRetry={() => void settings.refetch()}
          workspaceId={workspaceId}
        />
      ) : (
        <DeliveriesPanel
          data={deliveries.data}
          error={deliveries.error}
          loading={deliveries.loading}
          onRetry={() => void deliveries.refetch()}
        />
      )}

      {formOpen && workspaceId ? (
        <Modal
          description="Choose when and how Boardnest should remind your account."
          onClose={() => setFormOpen(false)}
          title={editingSchedule ? 'Edit notification' : 'Create notification'}
        >
          <ScheduledNotificationForm
            currentUserLabel={
              user?.email ?? user?.displayName ?? 'Your account'
            }
            minimumIntervalMinutes={plan?.minScheduleIntervalMinutes ?? 1440}
            notification={editingSchedule ?? undefined}
            onCancel={() => setFormOpen(false)}
            onCompleted={() => {
              setFormOpen(false);
              setActiveTab('schedules');
            }}
            projects={projects.data?.projects.nodes ?? []}
            workspaceId={workspaceId}
          />
        </Modal>
      ) : null}
    </>
  );
}

interface PanelQueryProps<T> {
  data: T | undefined;
  error: { message: string } | undefined;
  loading: boolean;
  onRetry: () => void;
}

function InboxPanel({
  data,
  error,
  loading,
  onRetry,
}: PanelQueryProps<NotificationsData>) {
  const navigate = useNavigate();
  const [pendingNotificationId, setPendingNotificationId] = useState<
    string | null
  >(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [markNotificationAsRead] = useMutation<MarkNotificationAsReadData>(
    MARK_NOTIFICATION_AS_READ_MUTATION,
  );

  if (loading) return <PageSkeleton />;
  if (error) return <QueryError message={error.message} onRetry={onRetry} />;
  const notifications = data?.notifications.nodes ?? [];
  if (!notifications.length) {
    return (
      <EmptyState
        description="Updates about tasks, invitations, projects, and reminders will appear here."
        title="You're all caught up"
      />
    );
  }

  async function markAsRead(notification: NotificationSummary) {
    if (notification.readAt) return true;

    setActionError(null);
    setPendingNotificationId(notification.id);
    const readAt = new Date().toISOString();
    try {
      await markNotificationAsRead({
        optimisticResponse: {
          markNotificationAsRead: {
            __typename: 'Notification',
            id: notification.id,
            readAt,
          },
        },
        variables: { id: notification.id },
      });
      return true;
    } catch (mutationError) {
      setActionError(notificationMutationMessage(mutationError));
      return false;
    } finally {
      setPendingNotificationId(null);
    }
  }

  async function openNotification(notification: NotificationSummary) {
    const route = notificationRoute(notification.payload);
    if (!route) return;
    if (notification.readAt || (await markAsRead(notification))) {
      void navigate(route);
    }
  }

  return (
    <div className="grid gap-3">
      {actionError ? (
        <p
          className="rounded-xl border border-rose-900/70 bg-rose-950/30 p-3 text-sm text-rose-200"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}
      {notifications.map((notification) => {
        const route = notificationRoute(notification.payload);
        const pending = pendingNotificationId === notification.id;
        const content = <NotificationContent notification={notification} />;
        return (
          <article
            className={`overflow-hidden rounded-2xl border ${
              notification.readAt
                ? 'border-slate-800 bg-slate-900/40'
                : 'border-indigo-400/30 bg-indigo-400/5'
            }`}
            key={notification.id}
          >
            {route ? (
              <button
                aria-label={`Open notification: ${notification.title}`}
                className="block w-full p-5 text-left transition hover:bg-slate-800/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-300 disabled:cursor-wait disabled:opacity-70"
                disabled={pending}
                onClick={() => void openNotification(notification)}
                type="button"
              >
                {content}
              </button>
            ) : (
              <div className="p-5">
                {content}
                {!notification.readAt ? (
                  <button
                    className={`${secondaryButtonClassName} mt-4`}
                    disabled={pending}
                    onClick={() => void markAsRead(notification)}
                    type="button"
                  >
                    {pending ? 'Marking as read…' : 'Mark as read'}
                  </button>
                ) : null}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

function NotificationContent({
  notification,
}: {
  notification: NotificationSummary;
}) {
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <h2 className="font-semibold text-slate-100">{notification.title}</h2>
        {!notification.readAt ? (
          <span className="rounded-full bg-indigo-400/15 px-2 py-1 text-xs font-semibold text-indigo-200">
            Unread
          </span>
        ) : null}
      </div>
      {notification.body ? (
        <p className="mt-1 text-sm leading-6 text-slate-400">
          {notification.body}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-slate-500">
        {formatDate(notification.createdAt)}
      </p>
    </>
  );
}

function SchedulesPanel({
  actionError,
  activeCount,
  limit,
  onAction,
  onCreate,
  onEdit,
  planName,
  schedules,
}: {
  actionError: string | null;
  activeCount: number;
  limit: number;
  onAction: (
    action: 'delete' | 'pause' | 'resume',
    schedule: ScheduledNotificationSummary,
  ) => void;
  onCreate: () => void;
  onEdit: (schedule: ScheduledNotificationSummary) => void;
  planName: string;
  schedules: ScheduledNotificationSummary[];
}) {
  return (
    <div className="grid gap-4">
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-300">
        <strong className="text-indigo-200">{planName} plan:</strong>{' '}
        {activeCount} of {limit} active custom schedules used.
      </div>
      {actionError ? (
        <p
          className="rounded-xl border border-rose-900/70 bg-rose-950/30 p-3 text-sm text-rose-200"
          role="alert"
        >
          {actionError}
        </p>
      ) : null}
      {!schedules.length ? (
        <EmptyState
          actionLabel="Create notification"
          description="Create a one-time or recurring personal notification."
          onAction={onCreate}
          title="No custom schedules yet"
        />
      ) : (
        schedules.map((schedule) => (
          <article
            className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5"
            key={schedule.id}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-slate-100">
                    {schedule.title}
                  </h2>
                  <StatusBadge status={schedule.status} />
                </div>
                {schedule.body ? (
                  <p className="mt-1 text-sm text-slate-400">{schedule.body}</p>
                ) : null}
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  Next: {formatDate(schedule.nextRunAt)} ·{' '}
                  {schedule.scheduleKind === 'ONCE'
                    ? 'One time'
                    : `Every ${schedule.intervalValue} ${schedule.intervalUnit?.toLowerCase()}`}{' '}
                  · {schedule.timezone} ·{' '}
                  {[
                    schedule.inAppEnabled ? 'In-app' : null,
                    schedule.emailEnabled ? 'Email' : null,
                  ]
                    .filter(Boolean)
                    .join(' + ')}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className={secondaryButtonClassName}
                  onClick={() => onEdit(schedule)}
                  type="button"
                >
                  Edit
                </button>
                {schedule.status === 'ACTIVE' ? (
                  <button
                    className={secondaryButtonClassName}
                    onClick={() => onAction('pause', schedule)}
                    type="button"
                  >
                    Pause
                  </button>
                ) : schedule.status === 'PAUSED' ? (
                  <button
                    className={secondaryButtonClassName}
                    onClick={() => onAction('resume', schedule)}
                    type="button"
                  >
                    Resume
                  </button>
                ) : null}
                <button
                  className="rounded-lg border border-rose-900 px-4 py-2.5 text-sm font-semibold text-rose-300 hover:bg-rose-950/40"
                  onClick={() => onAction('delete', schedule)}
                  type="button"
                >
                  Delete
                </button>
              </div>
            </div>
          </article>
        ))
      )}
    </div>
  );
}

function PreferencesPanel({
  data,
  error,
  loading,
  onRetry,
  workspaceId,
}: PanelQueryProps<NotificationSettingsData> & { workspaceId: string }) {
  const [saveEventPreference, eventMutation] = useMutation(
    UPDATE_NOTIFICATION_EVENT_PREFERENCE_MUTATION,
    {
      refetchQueries: [
        { query: NOTIFICATION_SETTINGS_QUERY, variables: { workspaceId } },
      ],
    },
  );
  const [saveGlobalPreference, globalMutation] = useMutation(
    UPDATE_NOTIFICATION_PREFERENCES_MUTATION,
    {
      refetchQueries: [
        { query: NOTIFICATION_SETTINGS_QUERY, variables: { workspaceId } },
      ],
    },
  );
  if (loading) return <PageSkeleton />;
  if (error || !data) {
    return (
      <QueryError
        message={error?.message ?? 'Notification settings could not be loaded.'}
        onRetry={onRetry}
      />
    );
  }
  const overrides = new Map(
    data.notificationEventPreferences.map((item) => [item.eventType, item]),
  );
  const entitlements = new Map(
    data.notificationPlanEvents.map((item) => [item.eventType, item]),
  );
  const preferences = data.notificationPreferences;

  async function toggleEvent(
    eventType: string,
    current: NotificationEventPreferenceSummary,
    channel: 'emailEnabled' | 'inAppEnabled',
  ) {
    try {
      await saveEventPreference({
        variables: {
          input: { ...current, [channel]: !current[channel], eventType },
        },
      });
    } catch {
      // Apollo exposes the actionable error through eventMutation.error.
    }
  }

  async function toggleGlobal(channel: 'emailEnabled' | 'inAppEnabled') {
    try {
      await saveGlobalPreference({
        variables: {
          input: { [channel]: !preferences[channel] },
        },
      });
    } catch {
      // Apollo exposes the actionable error through globalMutation.error.
    }
  }

  return (
    <div className="grid gap-5">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
        <h2 className="font-semibold text-slate-100">Global channels</h2>
        <p className="mt-1 text-sm text-slate-400">
          Turning off a global channel overrides every event-specific choice.
        </p>
        <div className="mt-4 flex flex-wrap gap-5">
          {(['inAppEnabled', 'emailEnabled'] as const).map((channel) => (
            <label
              className="flex items-center gap-2 text-sm text-slate-300"
              key={channel}
            >
              <input
                checked={data.notificationPreferences[channel]}
                disabled={globalMutation.loading}
                onChange={() => void toggleGlobal(channel)}
                type="checkbox"
              />
              {channel === 'inAppEnabled' ? 'In-app' : 'Email'}
            </label>
          ))}
        </div>
      </section>

      <div className="grid gap-3">
        {data.notificationEventTypes.map((eventType) => {
          const override = overrides.get(eventType.code);
          const entitlement = entitlements.get(eventType.code);
          const current = {
            emailEnabled:
              override?.emailEnabled ?? eventType.defaultEmailEnabled,
            eventType: eventType.code,
            inAppEnabled:
              override?.inAppEnabled ?? eventType.defaultInAppEnabled,
          };
          return (
            <article
              className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5"
              key={eventType.code}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-2xl">
                  <h2 className="font-semibold text-slate-100">
                    {eventType.displayName}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {eventType.description}
                  </p>
                </div>
                <div className="flex flex-wrap gap-4">
                  {(['inAppEnabled', 'emailEnabled'] as const).map(
                    (channel) => {
                      const entitled =
                        channel === 'inAppEnabled'
                          ? entitlement?.inAppEnabled
                          : entitlement?.emailEnabled;
                      return (
                        <label
                          className="flex items-center gap-2 text-sm text-slate-300"
                          key={channel}
                          title={
                            entitled
                              ? undefined
                              : 'Not included in the current workspace plan'
                          }
                        >
                          <input
                            checked={current[channel] && Boolean(entitled)}
                            disabled={!entitled || eventMutation.loading}
                            onChange={() =>
                              void toggleEvent(eventType.code, current, channel)
                            }
                            type="checkbox"
                          />
                          {channel === 'inAppEnabled' ? 'In-app' : 'Email'}
                        </label>
                      );
                    },
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {eventMutation.error || globalMutation.error ? (
        <p className="text-sm text-rose-300" role="alert">
          {notificationMutationMessage(
            eventMutation.error ?? globalMutation.error,
          )}
        </p>
      ) : null}
    </div>
  );
}

function DeliveriesPanel({
  data,
  error,
  loading,
  onRetry,
}: PanelQueryProps<NotificationDeliveriesData>) {
  if (loading) return <PageSkeleton />;
  if (error) return <QueryError message={error.message} onRetry={onRetry} />;
  const deliveries = data?.notificationDeliveries.nodes ?? [];
  if (!deliveries.length) {
    return (
      <EmptyState
        description="Email attempts for reminders and notification events will appear here."
        title="No email deliveries yet"
      />
    );
  }
  return (
    <div className="grid gap-3">
      {deliveries.map((delivery) => (
        <article
          className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5"
          key={delivery.id}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-semibold text-slate-100">
                  {delivery.reminderId
                    ? 'Task reminder email'
                    : 'Notification email'}
                </h2>
                <StatusBadge status={delivery.status} />
              </div>
              <p className="mt-2 text-sm text-slate-400">
                Scheduled {formatDate(delivery.scheduledFor)} · Attempt{' '}
                {delivery.attemptCount} of {delivery.maxAttempts}
              </p>
              {delivery.status === 'FAILED' && delivery.errorMessage ? (
                <p className="mt-2 text-sm text-rose-300">
                  Delivery failed: {delivery.errorMessage}
                </p>
              ) : null}
            </div>
            {delivery.deliveredAt ? (
              <p className="text-xs text-slate-500">
                Delivered {formatDate(delivery.deliveredAt)}
              </p>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === 'ACTIVE' || status === 'DELIVERED'
      ? 'bg-emerald-400/10 text-emerald-300'
      : status === 'FAILED' || status === 'CANCELED'
        ? 'bg-rose-400/10 text-rose-300'
        : 'bg-amber-400/10 text-amber-200';
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-semibold ${color}`}>
      {status.toLowerCase()}
    </span>
  );
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}
