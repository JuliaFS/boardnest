begin;

-- Link generated notifications to one durable reminder occurrence. The partial
-- unique index is the final idempotency boundary across scheduler instances.
alter table public.notifications
  add column reminder_id uuid references public.task_reminders (id) on delete set null,
  add column scheduled_for timestamptz;

create unique index notifications_reminder_occurrence_unique_idx
  on public.notifications (reminder_id, user_id, scheduled_for)
  where reminder_id is not null;

create function private.next_task_reminder_run(
  schedule_kind text,
  previous_run_at timestamptz,
  reminder_timezone text
)
returns timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select case schedule_kind
    when 'weekly' then
      (previous_run_at at time zone reminder_timezone + interval '1 week')
        at time zone reminder_timezone
    when 'monthly' then
      (previous_run_at at time zone reminder_timezone + interval '1 month')
        at time zone reminder_timezone
    when 'quarterly' then
      (previous_run_at at time zone reminder_timezone + interval '3 months')
        at time zone reminder_timezone
    when 'yearly' then
      (previous_run_at at time zone reminder_timezone + interval '1 year')
        at time zone reminder_timezone
    else null
  end
$$;

create function public.process_due_task_reminders(
  p_batch_size integer default 100,
  p_now timestamptz default statement_timestamp()
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  due_reminder record;
  email_recipient record;
  occurrence_at timestamptz;
  following_run_at timestamptz;
  processed_count integer := 0;
begin
  if p_batch_size < 1 or p_batch_size > 500 then
    raise exception 'Reminder scheduler batch size must be between 1 and 500'
      using errcode = '22023';
  end if;

  for due_reminder in
    select
      reminder.*,
      task.title as task_title,
      task.archived_at as task_archived_at,
      task_status.category as task_status_category
    from public.task_reminders as reminder
    join public.tasks as task on task.id = reminder.task_id
    join public.task_statuses as task_status on task_status.id = task.status_id
    where reminder.status = 'active'
      and reminder.next_run_at <= p_now
    order by reminder.next_run_at, reminder.id
    limit p_batch_size
    for update of reminder skip locked
  loop
    occurrence_at := due_reminder.next_run_at;

    if due_reminder.task_archived_at is not null
      or (
        due_reminder.stop_when_completed
        and due_reminder.task_status_category = 'done'
      )
    then
      update public.task_reminders
      set status = 'completed'
      where id = due_reminder.id;
      processed_count := processed_count + 1;
      continue;
    end if;

    if due_reminder.in_app_enabled then
      insert into public.notifications (
        user_id,
        workspace_id,
        project_id,
        task_id,
        reminder_id,
        scheduled_for,
        type,
        title,
        body,
        payload
      )
      select
        recipient.user_id,
        due_reminder.workspace_id,
        due_reminder.project_id,
        due_reminder.task_id,
        due_reminder.id,
        occurrence_at,
        'task.reminder',
        left('Reminder: ' || due_reminder.task_title, 160),
        'A scheduled task reminder is due.',
        jsonb_build_object(
          'reminderId', due_reminder.id,
          'taskId', due_reminder.task_id,
          'projectId', due_reminder.project_id,
          'scheduledFor', occurrence_at
        )
      from public.task_reminder_recipients as recipient
      join public.notification_preferences as preference
        on preference.user_id = recipient.user_id
      where recipient.reminder_id = due_reminder.id
        and preference.in_app_enabled
        and preference.reminder_enabled
      on conflict (reminder_id, user_id, scheduled_for)
        where reminder_id is not null
      do nothing;
    end if;

    -- Stage 3 records an email outbox item but does not contact a provider.
    -- Stage 4 will claim and deliver these rows with retry handling.
    if due_reminder.email_enabled then
      for email_recipient in
        select recipient.user_id
        from public.task_reminder_recipients as recipient
        join public.notification_preferences as preference
          on preference.user_id = recipient.user_id
        where recipient.reminder_id = due_reminder.id
          and preference.email_enabled
          and preference.reminder_enabled
      loop
        begin
          insert into public.notification_deliveries (
            reminder_id,
            notification_id,
            workspace_id,
            user_id,
            scheduled_for,
            next_attempt_at,
            idempotency_key,
            payload
          )
          values (
            due_reminder.id,
            (
              select notification.id
              from public.notifications as notification
              where notification.reminder_id = due_reminder.id
                and notification.user_id = email_recipient.user_id
                and notification.scheduled_for = occurrence_at
            ),
            due_reminder.workspace_id,
            email_recipient.user_id,
            occurrence_at,
            p_now,
            'task-reminder:' || due_reminder.id::text || ':'
              || extract(epoch from occurrence_at)::text || ':'
              || email_recipient.user_id::text,
            jsonb_build_object(
              'reminderId', due_reminder.id,
              'taskId', due_reminder.task_id,
              'projectId', due_reminder.project_id,
              'scheduledFor', occurrence_at,
              'taskTitle', due_reminder.task_title
            )
          )
          on conflict (idempotency_key) do nothing;
        exception
          when sqlstate 'P0001' then
            -- A downgraded plan or exhausted monthly quota must not prevent an
            -- eligible in-app notification or block schedule advancement.
            null;
        end;
      end loop;
    end if;

    if due_reminder.schedule_kind = 'once' then
      update public.task_reminders
      set last_run_at = occurrence_at,
          status = 'completed'
      where id = due_reminder.id;
    else
      following_run_at := private.next_task_reminder_run(
        due_reminder.schedule_kind,
        occurrence_at,
        due_reminder.timezone
      );

      -- Skip stale occurrences after downtime instead of flooding recipients.
      while following_run_at <= p_now loop
        following_run_at := private.next_task_reminder_run(
          due_reminder.schedule_kind,
          following_run_at,
          due_reminder.timezone
        );
      end loop;

      if due_reminder.ends_at is not null
        and following_run_at >= due_reminder.ends_at
      then
        update public.task_reminders
        set last_run_at = occurrence_at,
            status = 'completed'
        where id = due_reminder.id;
      else
        update public.task_reminders
        set last_run_at = occurrence_at,
            next_run_at = following_run_at
        where id = due_reminder.id;
      end if;
    end if;

    processed_count := processed_count + 1;
  end loop;

  return processed_count;
end;
$$;

revoke all on function private.next_task_reminder_run(text, timestamptz, text)
from public, anon, authenticated;
revoke all on function public.process_due_task_reminders(integer, timestamptz)
from public, anon, authenticated;

grant execute on function public.process_due_task_reminders(integer, timestamptz)
to service_role;

comment on column public.notifications.reminder_id is
  'Reminder occurrence source; combined with recipient and scheduled time for idempotency.';
comment on function public.process_due_task_reminders(integer, timestamptz) is
  'Service-role-only, concurrency-safe scheduler transaction for due reminder occurrences.';

commit;
