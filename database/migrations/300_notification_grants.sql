begin;

revoke all on table
  public.subscription_plans,
  public.workspace_subscriptions,
  public.notification_preferences,
  public.task_reminders,
  public.task_reminder_recipients,
  public.notification_deliveries
from anon, authenticated;

grant select on table
  public.subscription_plans,
  public.workspace_subscriptions,
  public.notification_preferences,
  public.task_reminders,
  public.task_reminder_recipients,
  public.notification_deliveries
to authenticated;

grant update (
  in_app_enabled,
  email_enabled,
  task_created_enabled,
  task_assigned_enabled,
  reminder_enabled
) on public.notification_preferences to authenticated;

grant insert (
  task_id,
  created_by,
  schedule_kind,
  timezone,
  next_run_at,
  ends_at,
  in_app_enabled,
  email_enabled,
  stop_when_completed,
  status
) on public.task_reminders to authenticated;

grant update (
  schedule_kind,
  timezone,
  next_run_at,
  ends_at,
  in_app_enabled,
  email_enabled,
  stop_when_completed,
  status
) on public.task_reminders to authenticated;

grant delete on public.task_reminders to authenticated;
grant insert, delete on public.task_reminder_recipients to authenticated;

grant execute on function private.can_view_task_reminder(uuid) to authenticated;
grant execute on function private.can_manage_task_reminder(uuid) to authenticated;

grant select, insert, update, delete on table
  public.subscription_plans,
  public.workspace_subscriptions,
  public.notification_preferences,
  public.task_reminders,
  public.task_reminder_recipients,
  public.notification_deliveries
to service_role;

commit;
