import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import {
  CREATE_SCHEDULED_NOTIFICATION_MUTATION,
  BOARD_QUERY,
  SCHEDULED_NOTIFICATIONS_QUERY,
  UPDATE_SCHEDULED_NOTIFICATION_MUTATION,
  type ProjectSummary,
  type BoardData,
  type ScheduledNotificationSummary,
} from '../core/graphql';
import {
  fieldClassName,
  labelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from '../core/form-styles';
import {
  notificationMutationMessage,
  scheduledNotificationFormSchema,
  toDateTimeLocal,
  toIsoDate,
  type ScheduledNotificationFormValues,
} from './notification-schemas';

interface ScheduledNotificationFormProps {
  currentUserLabel: string;
  minimumIntervalMinutes: number;
  notification?: ScheduledNotificationSummary | undefined;
  onCancel: () => void;
  onCompleted: () => void;
  projects: ProjectSummary[];
  workspaceId: string;
}

interface MutationData {
  createScheduledNotification?: ScheduledNotificationSummary;
  updateScheduledNotification?: ScheduledNotificationSummary;
}

type ScheduleInput = {
  body: string | null;
  emailEnabled: boolean;
  endsAt: string | null;
  inAppEnabled: boolean;
  intervalUnit: ScheduledNotificationFormValues['intervalUnit'] | null;
  intervalValue: number | null;
  nextRunAt: string;
  projectId: string | null;
  scheduleKind: ScheduledNotificationFormValues['scheduleKind'];
  taskId: string | null;
  timezone: string;
  title: string;
  workspaceId?: string;
};

const intervalMinutes = {
  DAY: 1440,
  HOUR: 60,
  MINUTE: 1,
  MONTH: 43200,
  WEEK: 10080,
  YEAR: 525600,
} as const;

export function ScheduledNotificationForm({
  currentUserLabel,
  minimumIntervalMinutes,
  notification,
  onCancel,
  onCompleted,
  projects,
  workspaceId,
}: ScheduledNotificationFormProps) {
  const editing = Boolean(notification);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saveNotification] = useMutation<
    MutationData,
    { id?: string; input: ScheduleInput }
  >(
    editing
      ? UPDATE_SCHEDULED_NOTIFICATION_MUTATION
      : CREATE_SCHEDULED_NOTIFICATION_MUTATION,
    {
      refetchQueries: [
        { query: SCHEDULED_NOTIFICATIONS_QUERY, variables: { workspaceId } },
      ],
    },
  );
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    setError,
    setValue,
  } = useForm<ScheduledNotificationFormValues>({
    defaultValues: {
      body: notification?.body ?? '',
      emailEnabled: notification?.emailEnabled ?? false,
      endsAt: toDateTimeLocal(notification?.endsAt),
      inAppEnabled: notification?.inAppEnabled ?? true,
      intervalUnit: notification?.intervalUnit ?? 'WEEK',
      intervalValue: notification?.intervalValue ?? 1,
      nextRunAt:
        toDateTimeLocal(notification?.nextRunAt) ||
        toDateTimeLocal(new Date(Date.now() + 3_600_000).toISOString()),
      projectId: notification?.projectId ?? '',
      scheduleKind: notification?.scheduleKind ?? 'ONCE',
      taskId: notification?.taskId ?? '',
      timezone:
        notification?.timezone ??
        Intl.DateTimeFormat().resolvedOptions().timeZone ??
        'UTC',
      title: notification?.title ?? '',
    },
    resolver: zodResolver(scheduledNotificationFormSchema),
  });
  const scheduleKind = useWatch({ control, name: 'scheduleKind' });
  const selectedProjectId = useWatch({ control, name: 'projectId' });
  const tasks = useQuery<BoardData>(BOARD_QUERY, {
    skip: !selectedProjectId,
    variables: { projectId: selectedProjectId },
  });
  const availableTasks = tasks.data?.tasks.nodes ?? [];

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) =>
        void handleSubmit(async (values) => {
          setSubmitError(null);
          if (
            values.scheduleKind === 'INTERVAL' &&
            values.intervalValue * intervalMinutes[values.intervalUnit] <
              minimumIntervalMinutes
          ) {
            setError('intervalValue', {
              message: `Your plan requires an interval of at least ${formatMinutes(minimumIntervalMinutes)}.`,
            });
            return;
          }

          const recurring = values.scheduleKind === 'INTERVAL';
          const input: ScheduleInput = {
            body: values.body.trim() || null,
            emailEnabled: values.emailEnabled,
            endsAt: values.endsAt ? toIsoDate(values.endsAt) : null,
            inAppEnabled: values.inAppEnabled,
            intervalUnit: recurring ? values.intervalUnit : null,
            intervalValue: recurring ? values.intervalValue : null,
            nextRunAt: toIsoDate(values.nextRunAt),
            projectId: values.projectId || null,
            scheduleKind: values.scheduleKind,
            taskId: values.taskId || null,
            timezone: values.timezone.trim(),
            title: values.title.trim(),
            ...(editing ? {} : { workspaceId }),
          };

          try {
            await saveNotification({
              variables: {
                input,
                ...(notification ? { id: notification.id } : {}),
              },
            });
            onCompleted();
          } catch (error) {
            setSubmitError(notificationMutationMessage(error));
          }
        })(event)
      }
    >
      <label className={labelClassName}>
        Title
        <input autoFocus className={fieldClassName} {...register('title')} />
        <FieldError message={errors.title?.message} />
      </label>

      <label className={labelClassName}>
        Message
        <textarea
          className={`${fieldClassName} min-h-24 resize-y`}
          {...register('body')}
        />
        <FieldError message={errors.body?.message} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName}>
          Project context
          <select
            className={fieldClassName}
            {...register('projectId', {
              onChange: () => setValue('taskId', ''),
            })}
          >
            <option value="">Workspace only</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
          <FieldError message={errors.projectId?.message} />
        </label>
        <label className={labelClassName}>
          Task context
          <select
            className={fieldClassName}
            disabled={!selectedProjectId}
            {...register('taskId')}
          >
            <option value="">No task</option>
            {availableTasks.map((task) => (
              <option key={task.id} value={task.id}>
                {task.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-1.5">
        <label className={labelClassName} htmlFor="notification-recipient">
          Recipient
        </label>
        <select
          className={fieldClassName}
          disabled
          id="notification-recipient"
          value="self"
        >
          <option value="self">{currentUserLabel} (you)</option>
        </select>
        <span className="text-xs font-normal text-slate-500">
          Custom schedules are personal in this release. Team delivery will use
          a separate recipient authorization model.
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName}>
          Schedule
          <select className={fieldClassName} {...register('scheduleKind')}>
            <option value="ONCE">One time</option>
            <option value="INTERVAL">Recurring interval</option>
          </select>
        </label>
        <label className={labelClassName}>
          First delivery
          <input
            className={fieldClassName}
            type="datetime-local"
            {...register('nextRunAt')}
          />
          <FieldError message={errors.nextRunAt?.message} />
        </label>
      </div>

      {scheduleKind === 'INTERVAL' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClassName}>
            Repeat every
            <input
              className={fieldClassName}
              min="1"
              max="1000"
              type="number"
              {...register('intervalValue', { valueAsNumber: true })}
            />
            <FieldError message={errors.intervalValue?.message} />
          </label>
          <label className={labelClassName}>
            Interval unit
            <select className={fieldClassName} {...register('intervalUnit')}>
              <option value="MINUTE">Minutes</option>
              <option value="HOUR">Hours</option>
              <option value="DAY">Days</option>
              <option value="WEEK">Weeks</option>
              <option value="MONTH">Months</option>
              <option value="YEAR">Years</option>
            </select>
          </label>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <label className={labelClassName}>
          Timezone
          <input className={fieldClassName} {...register('timezone')} />
          <FieldError message={errors.timezone?.message} />
        </label>
        <label className={labelClassName}>
          End time (optional)
          <input
            className={fieldClassName}
            type="datetime-local"
            {...register('endsAt')}
          />
          <FieldError message={errors.endsAt?.message} />
        </label>
      </div>

      <fieldset className="rounded-xl border border-slate-700 p-4">
        <legend className="px-1 text-sm font-semibold text-slate-300">
          Delivery channels
        </legend>
        <div className="mt-1 flex flex-wrap gap-5">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" {...register('inAppEnabled')} />
            In-app notification
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" {...register('emailEnabled')} />
            Email
          </label>
        </div>
        <FieldError message={errors.inAppEnabled?.message} />
      </fieldset>

      {submitError ? (
        <p
          className="rounded-xl border border-rose-900/70 bg-rose-950/30 p-3 text-sm text-rose-200"
          role="alert"
        >
          {submitError}
        </p>
      ) : null}

      <div className="mt-2 flex justify-end gap-3">
        <button
          className={secondaryButtonClassName}
          onClick={onCancel}
          type="button"
        >
          Cancel
        </button>
        <button
          className={primaryButtonClassName}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? 'Saving…' : editing ? 'Save changes' : 'Create'}
        </button>
      </div>
    </form>
  );
}

function FieldError({ message }: { message: string | undefined }) {
  return message ? (
    <span className="text-xs text-rose-300">{message}</span>
  ) : null;
}

function formatMinutes(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440} day(s)`;
  if (minutes % 60 === 0) return `${minutes / 60} hour(s)`;
  return `${minutes} minute(s)`;
}
