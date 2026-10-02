begin;

create function private.can_view_task_reminder(target_reminder_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.task_reminders as tr
      where tr.id = target_reminder_id
        and (
          tr.created_by = (select auth.uid())
          or private.can_manage_task(tr.task_id)
          or exists (
            select 1
            from public.task_reminder_recipients as recipient
            where recipient.reminder_id = tr.id
              and recipient.user_id = (select auth.uid())
          )
        )
    )
$$;

create function private.can_manage_task_reminder(target_reminder_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.task_reminders as tr
      where tr.id = target_reminder_id
        and (
          tr.created_by = (select auth.uid())
          or private.can_manage_task(tr.task_id)
        )
    )
$$;

revoke execute on function private.can_view_task_reminder(uuid) from public;
revoke execute on function private.can_manage_task_reminder(uuid) from public;

create policy "subscription_plans_select_public"
on public.subscription_plans for select to authenticated
using (is_public);

create policy "workspace_subscriptions_select_member"
on public.workspace_subscriptions for select to authenticated
using ((select private.is_workspace_member(workspace_id)));

create policy "notification_preferences_select_self"
on public.notification_preferences for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "notification_preferences_update_self"
on public.notification_preferences for update to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()))
with check ((select auth.uid()) is not null and user_id = (select auth.uid()));

create policy "task_reminders_select_authorized"
on public.task_reminders for select to authenticated
using ((select private.can_view_task_reminder(id)));

create policy "task_reminders_insert_contributor"
on public.task_reminders for insert to authenticated
with check (
  created_by = (select auth.uid())
  and (select private.can_edit_task(task_id))
);

create policy "task_reminders_update_manager"
on public.task_reminders for update to authenticated
using ((select private.can_manage_task_reminder(id)))
with check ((select private.can_manage_task_reminder(id)));

create policy "task_reminders_delete_manager"
on public.task_reminders for delete to authenticated
using ((select private.can_manage_task_reminder(id)));

create policy "task_reminder_recipients_select_authorized"
on public.task_reminder_recipients for select to authenticated
using ((select private.can_view_task_reminder(reminder_id)));

create policy "task_reminder_recipients_insert_manager"
on public.task_reminder_recipients for insert to authenticated
with check ((select private.can_manage_task_reminder(reminder_id)));

create policy "task_reminder_recipients_delete_manager"
on public.task_reminder_recipients for delete to authenticated
using ((select private.can_manage_task_reminder(reminder_id)));

create policy "notification_deliveries_select_recipient"
on public.notification_deliveries for select to authenticated
using ((select auth.uid()) is not null and user_id = (select auth.uid()));

comment on function private.can_view_task_reminder(uuid) is
  'Allows reminder creators, recipients, and task managers to view a reminder.';
comment on function private.can_manage_task_reminder(uuid) is
  'Allows reminder creators and task managers to change a reminder.';

commit;
