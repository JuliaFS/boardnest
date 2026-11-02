import {
  MobileNotificationDeliveriesDocument,
  MobileNotificationsDocument,
  MobileNotificationSettingsDocument,
  MobileProjectsDocument,
  MobileScheduledNotificationsDocument,
  MobileWorkspacesDocument,
  type MobileScheduledNotificationFieldsFragment,
} from '@boardnest/graphql-types';
import { useQuery } from '@apollo/client/react';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  AppButton,
  AppScreen,
  BottomSheetModal,
  EmptyState,
  ErrorState,
  LoadingState,
  useFeedback,
} from '@/components/ui';
import {
  DeliveriesPanel,
  InboxPanel,
  PreferencesPanel,
  SchedulesPanel,
} from '@/features/notifications/NotificationPanels';
import { NotificationScheduleSheet } from '@/features/notifications/NotificationScheduleSheet';
import { theme } from '@/theme';

type NotificationTab = 'deliveries' | 'inbox' | 'preferences' | 'schedules';

const tabs: { label: string; value: NotificationTab }[] = [
  { label: 'Inbox', value: 'inbox' },
  { label: 'Schedules', value: 'schedules' },
  { label: 'Preferences', value: 'preferences' },
  { label: 'Deliveries', value: 'deliveries' },
];

export default function NotificationsScreen() {
  const { showToast } = useFeedback();
  const [activeTab, setActiveTab] = useState<NotificationTab>('inbox');
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [editingSchedule, setEditingSchedule] =
    useState<MobileScheduledNotificationFieldsFragment | null>(null);
  const workspaces = useQuery(MobileWorkspacesDocument, {
    fetchPolicy: 'cache-and-network',
  });
  const workspaceNodes = workspaces.data?.workspaces.nodes ?? [];
  const activeWorkspaceId =
    workspaceNodes.find(({ id }) => id === selectedWorkspaceId)?.id ??
    workspaceNodes[0]?.id ??
    '';
  const inbox = useQuery(MobileNotificationsDocument, {
    fetchPolicy: 'cache-and-network',
  });
  const projects = useQuery(MobileProjectsDocument, {
    skip: !activeWorkspaceId,
    variables: { workspaceId: activeWorkspaceId },
  });
  const schedules = useQuery(MobileScheduledNotificationsDocument, {
    skip: !activeWorkspaceId || activeTab !== 'schedules',
    variables: { workspaceId: activeWorkspaceId },
  });
  const settings = useQuery(MobileNotificationSettingsDocument, {
    skip: !activeWorkspaceId,
    variables: { workspaceId: activeWorkspaceId },
  });
  const deliveries = useQuery(MobileNotificationDeliveriesDocument, {
    skip: !activeWorkspaceId || activeTab !== 'deliveries',
    variables: { workspaceId: activeWorkspaceId },
  });

  useEffect(() => {
    if (!selectedWorkspaceId && workspaceNodes[0]) {
      setSelectedWorkspaceId(workspaceNodes[0].id);
    }
  }, [selectedWorkspaceId, workspaceNodes]);

  const plan = settings.data?.workspaceSubscription?.plan;
  const scheduleNodes = schedules.data?.scheduledNotifications ?? [];
  const activeScheduleCount = scheduleNodes.filter(
    (schedule) => schedule.status === 'ACTIVE',
  ).length;

  if (workspaces.loading && !workspaces.data) {
    return (
      <AppScreen title="Notifications">
        <LoadingState title="Loading notification context" />
      </AppScreen>
    );
  }
  if (workspaces.error && !workspaces.data) {
    return (
      <AppScreen title="Notifications">
        <ErrorState
          actionLabel="Try again"
          description={workspaces.error.message}
          onAction={() => void workspaces.refetch()}
          title="Notification context could not be loaded"
        />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      eyebrow="NOTIFICATIONS"
      title="Notifications"
      description="Review updates, personal schedules, delivery preferences, and email history."
    >
      <View accessibilityRole="tablist" style={styles.tabs}>
        {tabs.map((tab) => (
          <AppButton
            accessibilityLabel={`${tab.label} notification tab`}
            key={tab.value}
            label={tab.label}
            onPress={() => setActiveTab(tab.value)}
            variant={activeTab === tab.value ? 'primary' : 'secondary'}
          />
        ))}
      </View>
      {activeTab !== 'inbox' && workspaceNodes.length > 0 ? (
        <AppButton
          label={
            workspaceNodes.find(({ id }) => id === activeWorkspaceId)?.name ??
            'Choose workspace'
          }
          onPress={() => setShowWorkspacePicker(true)}
          variant="secondary"
        />
      ) : null}
      {activeTab === 'inbox' ? (
        <InboxPanel
          data={inbox.data}
          error={inbox.error}
          loading={inbox.loading}
          onRetry={() => void inbox.refetch()}
        />
      ) : !activeWorkspaceId ? (
        <EmptyState
          description="Create or join a workspace before configuring notifications."
          title="No workspace available"
        />
      ) : activeTab === 'schedules' && settings.loading && !settings.data ? (
        <LoadingState title="Loading workspace notification plan" />
      ) : activeTab === 'schedules' && settings.error && !settings.data ? (
        <ErrorState
          actionLabel="Try again"
          description={settings.error.message}
          onAction={() => void settings.refetch()}
          title="Notification plan could not be loaded"
        />
      ) : activeTab === 'schedules' ? (
        <SchedulesPanel
          activeCount={activeScheduleCount}
          data={schedules.data}
          error={schedules.error}
          limit={plan?.maxScheduledNotifications ?? 0}
          loading={schedules.loading}
          onCreate={() => {
            setEditingSchedule(null);
            setShowScheduleForm(true);
          }}
          onEdit={(schedule) => {
            setEditingSchedule(schedule);
            setShowScheduleForm(true);
          }}
          onRetry={() => void schedules.refetch()}
          planName={plan?.displayName ?? 'Current'}
          workspaceId={activeWorkspaceId}
        />
      ) : activeTab === 'preferences' ? (
        <PreferencesPanel
          data={settings.data}
          error={settings.error}
          loading={settings.loading}
          onRetry={() => void settings.refetch()}
          workspaceId={activeWorkspaceId}
        />
      ) : (
        <DeliveriesPanel
          data={deliveries.data}
          error={deliveries.error}
          loading={deliveries.loading}
          onRetry={() => void deliveries.refetch()}
        />
      )}
      <BottomSheetModal
        description="Notification schedules, preferences, and delivery history are workspace-scoped."
        onClose={() => setShowWorkspacePicker(false)}
        title="Choose workspace"
        visible={showWorkspacePicker}
      >
        <View style={styles.options}>
          {workspaceNodes.map((workspace) => (
            <AppButton
              key={workspace.id}
              label={workspace.name}
              onPress={() => {
                setSelectedWorkspaceId(workspace.id);
                setShowWorkspacePicker(false);
              }}
              variant={
                workspace.id === activeWorkspaceId ? 'primary' : 'secondary'
              }
            />
          ))}
        </View>
      </BottomSheetModal>
      {activeWorkspaceId ? (
        <NotificationScheduleSheet
          minimumIntervalMinutes={plan?.minScheduleIntervalMinutes ?? 1}
          notification={editingSchedule}
          onClose={() => setShowScheduleForm(false)}
          onCompleted={() => {
            setShowScheduleForm(false);
            setEditingSchedule(null);
            showToast({
              message: 'The notification schedule was saved.',
              tone: 'success',
            });
          }}
          projects={projects.data?.projects.nodes ?? []}
          visible={showScheduleForm}
          workspaceId={activeWorkspaceId}
        />
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  options: { gap: theme.spacing.sm },
  tabs: { gap: theme.spacing.sm },
});
