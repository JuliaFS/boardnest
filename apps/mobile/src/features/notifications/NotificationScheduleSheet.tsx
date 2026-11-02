import {
  CreateMobileScheduledNotificationDocument,
  MobileScheduledNotificationsDocument,
  MobileBoardDocument,
  UpdateMobileScheduledNotificationDocument,
  type MobileScheduledNotificationFieldsFragment,
  type ScheduleIntervalUnit,
  type ScheduledNotificationKind,
} from '@boardnest/graphql-types';
import { useMutation, useQuery } from '@apollo/client/react';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  AppBanner,
  AppButton,
  AppTextField,
  BottomSheetModal,
} from '@/components/ui';
import { theme } from '@/theme';

import {
  notificationErrorMessage,
  validateScheduleForm,
  type ScheduleFormErrors,
  type ScheduleFormValues,
} from './notification-model';

type ProjectOption = { id: string; name: string };

type NotificationScheduleSheetProps = {
  minimumIntervalMinutes: number;
  notification?: MobileScheduledNotificationFieldsFragment | null;
  onClose: () => void;
  onCompleted: () => void;
  projects: ProjectOption[];
  visible: boolean;
  workspaceId: string;
};

const intervalUnits: ScheduleIntervalUnit[] = [
  'MINUTE',
  'HOUR',
  'DAY',
  'WEEK',
  'MONTH',
  'YEAR',
];

export function NotificationScheduleSheet({
  minimumIntervalMinutes,
  notification,
  onClose,
  onCompleted,
  projects,
  visible,
  workspaceId,
}: NotificationScheduleSheetProps) {
  const [values, setValues] = useState<ScheduleFormValues>(() =>
    defaultValues(),
  );
  const [errors, setErrors] = useState<ScheduleFormErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const tasks = useQuery(MobileBoardDocument, {
    skip: !values.projectId || !visible,
    variables: { projectId: values.projectId },
  });
  const [createSchedule, createState] = useMutation(
    CreateMobileScheduledNotificationDocument,
  );
  const [updateSchedule, updateState] = useMutation(
    UpdateMobileScheduledNotificationDocument,
  );
  const mutationState = notification ? updateState : createState;

  useEffect(() => {
    if (!visible) return;
    setValues(
      notification ? valuesFromNotification(notification) : defaultValues(),
    );
    setErrors({});
    setSubmitError(null);
  }, [notification, visible]);

  function update<K extends keyof ScheduleFormValues>(
    field: K,
    value: ScheduleFormValues[K],
  ) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function submit() {
    const nextErrors = validateScheduleForm(values, minimumIntervalMinutes);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSubmitError(null);
    const recurring = values.scheduleKind === 'INTERVAL';
    const input = {
      body: values.body.trim() || null,
      emailEnabled: values.emailEnabled,
      endsAt: values.endsAt ? new Date(values.endsAt).toISOString() : null,
      inAppEnabled: values.inAppEnabled,
      intervalUnit: recurring ? values.intervalUnit : null,
      intervalValue: recurring ? Number(values.intervalValue) : null,
      nextRunAt: new Date(values.nextRunAt).toISOString(),
      projectId: values.projectId || null,
      scheduleKind: values.scheduleKind,
      taskId: values.taskId || null,
      timezone: values.timezone.trim(),
      title: values.title.trim(),
    };
    try {
      if (notification) {
        await updateSchedule({
          refetchQueries: [
            {
              query: MobileScheduledNotificationsDocument,
              variables: { workspaceId },
            },
          ],
          variables: { id: notification.id, input },
        });
      } else {
        await createSchedule({
          refetchQueries: [
            {
              query: MobileScheduledNotificationsDocument,
              variables: { workspaceId },
            },
          ],
          variables: { input: { ...input, workspaceId } },
        });
      }
      onCompleted();
    } catch (error) {
      setSubmitError(notificationErrorMessage(error));
    }
  }

  return (
    <BottomSheetModal
      description="Create a personal one-time or recurring notification."
      onClose={onClose}
      title={notification ? 'Edit notification' : 'New notification'}
      visible={visible}
    >
      <View style={styles.form}>
        <AppTextField
          error={errors.title}
          label="Title"
          onChangeText={(value) => update('title', value)}
          value={values.title}
        />
        <AppTextField
          label="Message"
          multiline
          numberOfLines={3}
          onChangeText={(value) => update('body', value)}
          value={values.body}
        />
        <OptionGroup label="Project context">
          <AppButton
            label="Workspace only"
            onPress={() => {
              update('projectId', '');
              update('taskId', '');
            }}
            variant={values.projectId ? 'secondary' : 'primary'}
          />
          {projects.map((project) => (
            <AppButton
              key={project.id}
              label={project.name}
              onPress={() => {
                update('projectId', project.id);
                update('taskId', '');
              }}
              variant={
                values.projectId === project.id ? 'primary' : 'secondary'
              }
            />
          ))}
        </OptionGroup>
        {values.projectId ? (
          <OptionGroup label="Task context">
            <AppButton
              label="No task"
              onPress={() => update('taskId', '')}
              variant={values.taskId ? 'secondary' : 'primary'}
            />
            {(tasks.data?.tasks.nodes ?? []).map((task) => (
              <AppButton
                key={task.id}
                label={task.title}
                onPress={() => update('taskId', task.id)}
                variant={values.taskId === task.id ? 'primary' : 'secondary'}
              />
            ))}
          </OptionGroup>
        ) : null}
        <OptionGroup label="Schedule">
          {(['ONCE', 'INTERVAL'] as ScheduledNotificationKind[]).map((kind) => (
            <AppButton
              key={kind}
              label={kind === 'ONCE' ? 'One time' : 'Recurring'}
              onPress={() => update('scheduleKind', kind)}
              variant={values.scheduleKind === kind ? 'primary' : 'secondary'}
            />
          ))}
        </OptionGroup>
        <AppTextField
          autoCapitalize="none"
          error={errors.nextRunAt}
          hint="ISO 8601, for example 2026-12-01T10:00:00+02:00."
          label="First delivery"
          onChangeText={(value) => update('nextRunAt', value)}
          value={values.nextRunAt}
        />
        {values.scheduleKind === 'INTERVAL' ? (
          <>
            <AppTextField
              error={errors.intervalValue}
              keyboardType="number-pad"
              label="Repeat every"
              onChangeText={(value) => update('intervalValue', value)}
              value={values.intervalValue}
            />
            <OptionGroup label="Interval unit">
              {intervalUnits.map((unit) => (
                <AppButton
                  key={unit}
                  label={unit.toLowerCase()}
                  onPress={() => update('intervalUnit', unit)}
                  variant={
                    values.intervalUnit === unit ? 'primary' : 'secondary'
                  }
                />
              ))}
            </OptionGroup>
          </>
        ) : null}
        <AppTextField
          autoCapitalize="none"
          label="Timezone"
          onChangeText={(value) => update('timezone', value)}
          value={values.timezone}
        />
        <AppTextField
          autoCapitalize="none"
          error={errors.endsAt}
          hint="Optional ISO 8601 date and time."
          label="End time"
          onChangeText={(value) => update('endsAt', value)}
          value={values.endsAt}
        />
        <OptionGroup label="Delivery channels">
          <AppButton
            label={`In-app: ${values.inAppEnabled ? 'On' : 'Off'}`}
            onPress={() => update('inAppEnabled', !values.inAppEnabled)}
            variant={values.inAppEnabled ? 'primary' : 'secondary'}
          />
          <AppButton
            label={`Email: ${values.emailEnabled ? 'On' : 'Off'}`}
            onPress={() => update('emailEnabled', !values.emailEnabled)}
            variant={values.emailEnabled ? 'primary' : 'secondary'}
          />
          {errors.channels ? (
            <Text accessibilityLiveRegion="polite" style={styles.error}>
              {errors.channels}
            </Text>
          ) : null}
        </OptionGroup>
        {submitError || mutationState.error ? (
          <AppBanner
            message={
              submitError ?? notificationErrorMessage(mutationState.error)
            }
            title="Notification could not be saved"
            tone="error"
          />
        ) : null}
        <View style={styles.actions}>
          <AppButton label="Cancel" onPress={onClose} variant="secondary" />
          <AppButton
            label={notification ? 'Save changes' : 'Create notification'}
            loading={mutationState.loading}
            onPress={() => void submit()}
          />
        </View>
      </View>
    </BottomSheetModal>
  );
}

function OptionGroup({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <View style={styles.options}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

function defaultValues(): ScheduleFormValues {
  return {
    body: '',
    emailEnabled: false,
    endsAt: '',
    inAppEnabled: true,
    intervalUnit: 'WEEK',
    intervalValue: '1',
    nextRunAt: new Date(Date.now() + 3_600_000).toISOString(),
    projectId: '',
    scheduleKind: 'ONCE',
    taskId: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    title: '',
  };
}

function valuesFromNotification(
  notification: MobileScheduledNotificationFieldsFragment,
): ScheduleFormValues {
  return {
    body: notification.body ?? '',
    emailEnabled: notification.emailEnabled,
    endsAt: notification.endsAt ?? '',
    inAppEnabled: notification.inAppEnabled,
    intervalUnit: notification.intervalUnit ?? 'WEEK',
    intervalValue: String(notification.intervalValue ?? 1),
    nextRunAt: notification.nextRunAt,
    projectId: notification.projectId ?? '',
    scheduleKind: notification.scheduleKind,
    taskId: notification.taskId ?? '',
    timezone: notification.timezone,
    title: notification.title,
  };
}

const styles = StyleSheet.create({
  actions: { gap: theme.spacing.sm },
  error: { color: theme.colors.danger, fontSize: 13, lineHeight: 18 },
  form: { gap: theme.spacing.lg },
  label: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
  options: { gap: theme.spacing.sm },
});
