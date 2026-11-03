import {
  DeleteMobileScheduledNotificationDocument,
  MarkMobileNotificationAsReadDocument,
  MobileNotificationsDocument,
  MobileNotificationSettingsDocument,
  MobileScheduledNotificationsDocument,
  MobileUnreadNotificationCountDocument,
  PauseMobileScheduledNotificationDocument,
  ResumeMobileScheduledNotificationDocument,
  UpdateMobileNotificationEventPreferenceDocument,
  UpdateMobileNotificationPreferencesDocument,
  type MobileNotificationDeliveriesQuery,
  type MobileNotificationsQuery,
  type MobileNotificationSettingsQuery,
  type MobileScheduledNotificationFieldsFragment,
  type MobileScheduledNotificationsQuery,
} from '@boardnest/graphql-types';
import { useApolloClient, useMutation } from '@apollo/client/react';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AppBanner,
  AppButton,
  EmptyState,
  ErrorState,
  LoadingState,
} from '@/components/ui';
import { MIN_TOUCH_TARGET, theme } from '@/theme';

import {
  mobileNotificationRoute,
  notificationErrorMessage,
} from './notification-model';
import {
  disablePushNotifications,
  enablePushNotifications,
  hasLocalPushRegistration,
} from './push-notifications';

type PanelState<T> = {
  data?: T;
  error?: Error;
  loading: boolean;
  onRetry: () => void;
};

export function InboxPanel({
  data,
  error,
  loading,
  onRetry,
}: PanelState<MobileNotificationsQuery>) {
  const router = useRouter();
  const client = useApolloClient();
  const [markRead, markState] = useMutation(
    MarkMobileNotificationAsReadDocument,
  );
  const notifications = data?.notifications.nodes ?? [];

  if (loading && !data) return <LoadingState title="Loading notifications" />;
  if (error && !data) {
    return (
      <ErrorState
        actionLabel="Try again"
        description={error.message}
        onAction={onRetry}
        title="Notifications could not be loaded"
      />
    );
  }
  if (!notifications.length) {
    return (
      <EmptyState
        description="Task, project, membership, and reminder updates will appear here."
        title="You're all caught up"
      />
    );
  }

  async function markNotificationRead(
    notification: MobileNotificationsQuery['notifications']['nodes'][number],
  ) {
    if (notification.readAt) return true;
    try {
      await markRead({
        optimisticResponse: {
          markNotificationAsRead: {
            __typename: 'Notification',
            id: notification.id,
            readAt: new Date().toISOString(),
          },
        },
        update(cache) {
          cache.updateQuery(
            { query: MobileUnreadNotificationCountDocument },
            (current) =>
              current
                ? {
                    unreadNotificationCount: Math.max(
                      0,
                      current.unreadNotificationCount - 1,
                    ),
                  }
                : current,
          );
        },
        variables: { id: notification.id },
      });
      return true;
    } catch {
      await client.refetchQueries({
        include: [
          MobileNotificationsDocument,
          MobileUnreadNotificationCountDocument,
        ],
      });
      return false;
    }
  }

  async function openNotification(
    notification: MobileNotificationsQuery['notifications']['nodes'][number],
  ) {
    const route = mobileNotificationRoute(notification);
    if (!route) return;
    if (await markNotificationRead(notification)) router.push(route);
  }

  return (
    <View accessibilityRole="list" style={styles.list}>
      {markState.error ? (
        <AppBanner
          message={notificationErrorMessage(markState.error)}
          title="Notification could not be updated"
          tone="error"
        />
      ) : null}
      {notifications.map((notification) => {
        const route = mobileNotificationRoute(notification);
        return (
          <View
            accessibilityLabel={`${notification.title}${notification.readAt ? '' : ', unread'}`}
            accessibilityRole="summary"
            key={notification.id}
            style={[styles.card, !notification.readAt && styles.unreadCard]}
          >
            <View style={styles.headingRow}>
              <Text style={styles.cardTitle}>{notification.title}</Text>
              {!notification.readAt ? (
                <Text style={styles.unreadLabel}>Unread</Text>
              ) : null}
            </View>
            {notification.body ? (
              <Text style={styles.body}>{notification.body}</Text>
            ) : null}
            <Text style={styles.meta}>
              {formatDate(notification.createdAt)}
            </Text>
            {route ? (
              <AppButton
                label="Open"
                onPress={() => void openNotification(notification)}
                variant="secondary"
              />
            ) : !notification.readAt ? (
              <AppButton
                label="Mark as read"
                onPress={() => void markNotificationRead(notification)}
                variant="secondary"
              />
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export function SchedulesPanel({
  activeCount,
  data,
  error,
  limit,
  loading,
  onCreate,
  onEdit,
  onRetry,
  planName,
  workspaceId,
}: PanelState<MobileScheduledNotificationsQuery> & {
  activeCount: number;
  limit: number;
  onCreate: () => void;
  onEdit: (schedule: MobileScheduledNotificationFieldsFragment) => void;
  planName: string;
  workspaceId: string;
}) {
  const refetchQueries = [
    { query: MobileScheduledNotificationsDocument, variables: { workspaceId } },
  ];
  const [pause, pauseState] = useMutation(
    PauseMobileScheduledNotificationDocument,
    { refetchQueries },
  );
  const [resume, resumeState] = useMutation(
    ResumeMobileScheduledNotificationDocument,
    { refetchQueries },
  );
  const [remove, removeState] = useMutation(
    DeleteMobileScheduledNotificationDocument,
    { refetchQueries },
  );
  const actionError =
    pauseState.error ?? resumeState.error ?? removeState.error;
  const schedules = data?.scheduledNotifications ?? [];

  if (loading && !data) return <LoadingState title="Loading schedules" />;
  if (error && !data) {
    return (
      <ErrorState
        actionLabel="Try again"
        description={error.message}
        onAction={onRetry}
        title="Schedules could not be loaded"
      />
    );
  }
  return (
    <View style={styles.list}>
      <AppBanner
        message={`${activeCount} of ${limit} active custom schedules used.`}
        title={`${planName} plan`}
      />
      <AppButton
        disabled={activeCount >= limit}
        label="New notification"
        onPress={onCreate}
      />
      {activeCount >= limit ? (
        <AppBanner
          message="Pause or delete an active schedule, or upgrade the workspace plan."
          title="Schedule quota reached"
          tone="warning"
        />
      ) : null}
      {actionError ? (
        <AppBanner
          message={notificationErrorMessage(actionError)}
          tone="error"
        />
      ) : null}
      {!schedules.length ? (
        <EmptyState
          description="Create a personal one-time or recurring notification."
          title="No custom schedules yet"
        />
      ) : (
        schedules.map((schedule) => (
          <View key={schedule.id} style={styles.card}>
            <View style={styles.headingRow}>
              <Text style={styles.cardTitle}>{schedule.title}</Text>
              <StatusLabel status={schedule.status} />
            </View>
            {schedule.body ? (
              <Text style={styles.body}>{schedule.body}</Text>
            ) : null}
            <Text style={styles.meta}>
              Next {formatDate(schedule.nextRunAt)} ·{' '}
              {schedule.scheduleKind === 'ONCE'
                ? 'one time'
                : `every ${schedule.intervalValue} ${schedule.intervalUnit?.toLowerCase()}`}
            </Text>
            <Text style={styles.meta}>
              {[
                schedule.inAppEnabled ? 'In-app' : null,
                schedule.emailEnabled ? 'Email' : null,
              ]
                .filter(Boolean)
                .join(' + ')}
            </Text>
            <AppButton
              label="Edit"
              onPress={() => onEdit(schedule)}
              variant="secondary"
            />
            {schedule.status === 'ACTIVE' ? (
              <AppButton
                label="Pause"
                onPress={() => void pause({ variables: { id: schedule.id } })}
                variant="secondary"
              />
            ) : schedule.status === 'PAUSED' ? (
              <AppButton
                label="Resume"
                onPress={() => void resume({ variables: { id: schedule.id } })}
                variant="secondary"
              />
            ) : null}
            <AppButton
              label="Delete"
              onPress={() => void remove({ variables: { id: schedule.id } })}
              variant="danger"
            />
          </View>
        ))
      )}
    </View>
  );
}

export function PreferencesPanel({
  data,
  error,
  loading,
  onRetry,
  workspaceId,
}: PanelState<MobileNotificationSettingsQuery> & { workspaceId: string }) {
  const refetchQueries = [
    { query: MobileNotificationSettingsDocument, variables: { workspaceId } },
  ];
  const [saveGlobal, globalState] = useMutation(
    UpdateMobileNotificationPreferencesDocument,
    { refetchQueries },
  );
  const [saveEvent, eventState] = useMutation(
    UpdateMobileNotificationEventPreferenceDocument,
    { refetchQueries },
  );
  const [pushRegistered, setPushRegistered] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  useEffect(() => {
    void hasLocalPushRegistration().then(setPushRegistered);
  }, []);
  if (loading && !data) return <LoadingState title="Loading preferences" />;
  if (error || !data) {
    return (
      <ErrorState
        actionLabel="Try again"
        description={
          error?.message ?? 'Notification preferences are unavailable.'
        }
        onAction={onRetry}
        title="Preferences could not be loaded"
      />
    );
  }
  const overrides = new Map(
    data.notificationEventPreferences.map((item) => [item.eventType, item]),
  );
  const entitlements = new Map(
    data.notificationPlanEvents.map((item) => [item.eventType, item]),
  );
  const mutationError = globalState.error ?? eventState.error;

  async function toggleDevicePush() {
    setPushBusy(true);
    setPushError(null);
    try {
      if (pushRegistered) await disablePushNotifications();
      else await enablePushNotifications();
      setPushRegistered(!pushRegistered);
    } catch (error) {
      setPushError(
        error instanceof Error ? error.message : 'Push setup failed.',
      );
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <View style={styles.list}>
      {mutationError ? (
        <AppBanner
          message={notificationErrorMessage(mutationError)}
          tone="error"
        />
      ) : null}
      {pushError ? <AppBanner message={pushError} tone="error" /> : null}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>This device</Text>
        <Text style={styles.body}>
          Push delivery requires permission and an EAS development or production
          build. Expo Go is not supported.
        </Text>
        <AppButton
          label={
            pushRegistered
              ? 'Disable push on this device'
              : 'Enable push on this device'
          }
          loading={pushBusy}
          onPress={() => void toggleDevicePush()}
          variant={pushRegistered ? 'secondary' : 'primary'}
        />
      </View>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Global channels</Text>
        <Text style={styles.body}>
          A disabled global channel overrides every event-specific preference.
        </Text>
        {(['inAppEnabled', 'emailEnabled', 'pushEnabled'] as const).map(
          (channel) => (
            <AppButton
              key={channel}
              label={`${channelLabel(channel)}: ${data.notificationPreferences[channel] ? 'On' : 'Off'}`}
              loading={globalState.loading}
              onPress={() =>
                void saveGlobal({
                  variables: {
                    input: {
                      [channel]: !data.notificationPreferences[channel],
                    },
                  },
                })
              }
              variant={
                data.notificationPreferences[channel] ? 'primary' : 'secondary'
              }
            />
          ),
        )}
      </View>
      {data.notificationEventTypes.map((eventType) => {
        const override = overrides.get(eventType.code);
        const entitlement = entitlements.get(eventType.code);
        const current = {
          emailEnabled: override?.emailEnabled ?? eventType.defaultEmailEnabled,
          inAppEnabled: override?.inAppEnabled ?? eventType.defaultInAppEnabled,
          pushEnabled: override?.pushEnabled ?? eventType.defaultPushEnabled,
        };
        return (
          <View key={eventType.code} style={styles.card}>
            <Text style={styles.cardTitle}>{eventType.displayName}</Text>
            <Text style={styles.body}>{eventType.description}</Text>
            {(['inAppEnabled', 'emailEnabled', 'pushEnabled'] as const).map(
              (channel) => {
                const entitled = Boolean(entitlement?.[channel]);
                return (
                  <AppButton
                    disabled={!entitled}
                    key={channel}
                    label={`${channelLabel(channel)}: ${entitled && current[channel] ? 'On' : 'Off'}`}
                    loading={eventState.loading}
                    onPress={() =>
                      void saveEvent({
                        variables: {
                          input: {
                            emailEnabled: current.emailEnabled,
                            eventType: eventType.code,
                            inAppEnabled: current.inAppEnabled,
                            pushEnabled: current.pushEnabled,
                            [channel]: !current[channel],
                          },
                        },
                      })
                    }
                    variant={
                      entitled && current[channel] ? 'primary' : 'secondary'
                    }
                  />
                );
              },
            )}
            {!entitlement?.emailEnabled ? (
              <Text style={styles.quotaHint}>
                Email is not included for this event on the current plan.
              </Text>
            ) : null}
            {!entitlement?.pushEnabled ? (
              <Text style={styles.quotaHint}>
                Push is not included for this event on the current plan.
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export function DeliveriesPanel({
  data,
  error,
  loading,
  onRetry,
}: PanelState<MobileNotificationDeliveriesQuery>) {
  if (loading && !data)
    return <LoadingState title="Loading delivery history" />;
  if (error && !data) {
    return (
      <ErrorState
        actionLabel="Try again"
        description={error.message}
        onAction={onRetry}
        title="Delivery history could not be loaded"
      />
    );
  }
  const deliveries = data?.notificationDeliveries.nodes ?? [];
  if (!deliveries.length) {
    return (
      <EmptyState
        description="Email and push attempts for reminders and notification events will appear here."
        title="No deliveries yet"
      />
    );
  }
  return (
    <View style={styles.list}>
      {deliveries.map((delivery) => (
        <View key={delivery.id} style={styles.card}>
          <View style={styles.headingRow}>
            <Text style={styles.cardTitle}>
              {delivery.reminderId
                ? `Task reminder ${delivery.channel}`
                : `Notification ${delivery.channel}`}
            </Text>
            <StatusLabel status={delivery.status} />
          </View>
          <Text style={styles.body}>
            Scheduled {formatDate(delivery.scheduledFor)} · attempt{' '}
            {delivery.attemptCount} of {delivery.maxAttempts}
          </Text>
          {delivery.deliveredAt ? (
            <Text style={styles.meta}>
              Delivered {formatDate(delivery.deliveredAt)}
            </Text>
          ) : null}
          {delivery.errorMessage ? (
            <Text style={styles.errorText}>{delivery.errorMessage}</Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function StatusLabel({ status }: { status: string }) {
  return <Text style={styles.status}>{status.toLowerCase()}</Text>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function channelLabel(
  channel: 'emailEnabled' | 'inAppEnabled' | 'pushEnabled',
): string {
  if (channel === 'inAppEnabled') return 'In-app';
  if (channel === 'emailEnabled') return 'Email';
  return 'Push';
}

const styles = StyleSheet.create({
  body: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  card: {
    minHeight: MIN_TOUCH_TARGET,
    gap: theme.spacing.sm,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
  },
  cardTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  errorText: { color: theme.colors.danger, fontSize: 13, lineHeight: 18 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
  },
  list: { gap: theme.spacing.md },
  meta: { color: theme.colors.textMuted, fontSize: 12, lineHeight: 17 },
  quotaHint: { color: theme.colors.warning, fontSize: 12, lineHeight: 17 },
  status: { color: theme.colors.primary, fontSize: 12, fontWeight: '800' },
  unreadCard: { borderColor: theme.colors.primary },
  unreadLabel: { color: theme.colors.primary, fontSize: 12, fontWeight: '800' },
});
