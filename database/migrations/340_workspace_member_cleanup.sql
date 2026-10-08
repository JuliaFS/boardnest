begin;

-- Removing workspace access must also remove user-specific relationships that
-- do not reference workspace_members directly. Project membership already
-- cascades through its composite foreign key.
create function private.cleanup_removed_workspace_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.notification_deliveries as delivery
  where delivery.workspace_id = old.workspace_id
    and delivery.user_id = old.user_id;

  delete from public.notifications as notification
  where notification.workspace_id = old.workspace_id
    and notification.user_id = old.user_id;

  delete from public.task_reminder_recipients as recipient
  using public.task_reminders as reminder
  where recipient.reminder_id = reminder.id
    and reminder.workspace_id = old.workspace_id
    and recipient.user_id = old.user_id;

  delete from public.task_reminders as reminder
  where reminder.workspace_id = old.workspace_id
    and reminder.created_by = old.user_id;

  delete from public.task_assignees as assignee
  using public.tasks as task, public.projects as project
  where assignee.task_id = task.id
    and task.project_id = project.id
    and project.workspace_id = old.workspace_id
    and assignee.user_id = old.user_id;

  return old;
end;
$$;

revoke execute on function private.cleanup_removed_workspace_member() from public;

create trigger workspace_members_cleanup_removed_member
after delete on public.workspace_members
for each row execute function private.cleanup_removed_workspace_member();

comment on function private.cleanup_removed_workspace_member() is
  'Removes workspace-scoped assignments, reminders, deliveries, and notifications after membership revocation.';

commit;
