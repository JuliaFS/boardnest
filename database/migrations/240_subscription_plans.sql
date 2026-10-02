begin;

-- Product capabilities live in data so API and workers do not hardcode plan limits.
create table public.subscription_plans (
  code text primary key,
  display_name text not null,
  description text not null,
  max_active_reminder_tasks integer not null,
  max_reminders_per_task integer not null,
  max_recipients_per_reminder integer not null,
  monthly_email_limit integer not null,
  email_enabled boolean not null default false,
  notification_retention_days integer not null,
  is_public boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  constraint subscription_plans_code_format_check
    check (code ~ '^[a-z][a-z0-9_]*$' and char_length(code) between 2 and 40),
  constraint subscription_plans_display_name_length_check
    check (char_length(btrim(display_name)) between 1 and 80),
  constraint subscription_plans_description_length_check
    check (char_length(btrim(description)) between 1 and 1000),
  constraint subscription_plans_limits_check
    check (
      max_active_reminder_tasks >= 0
      and max_reminders_per_task >= 0
      and max_recipients_per_reminder >= 0
      and monthly_email_limit >= 0
      and notification_retention_days between 1 and 3650
    ),
  constraint subscription_plans_email_consistency_check
    check (email_enabled or monthly_email_limit = 0)
);

alter table public.subscription_plans enable row level security;

insert into public.subscription_plans (
  code,
  display_name,
  description,
  max_active_reminder_tasks,
  max_reminders_per_task,
  max_recipients_per_reminder,
  monthly_email_limit,
  email_enabled,
  notification_retention_days
)
values
  (
    'guest',
    'Guest',
    'Anonymous demo access with in-app reminders on up to three tasks.',
    3,
    1,
    1,
    0,
    false,
    7
  ),
  (
    'free',
    'Free',
    'Registered workspace with a small email allowance and task reminder quota.',
    10,
    1,
    10,
    25,
    true,
    30
  ),
  (
    'pro',
    'Pro',
    'Expanded reminder, recipient, email, and notification history limits.',
    100,
    5,
    50,
    1000,
    true,
    365
  );

comment on table public.subscription_plans is
  'Server-managed product capabilities and notification quotas for Boardnest plans.';
comment on column public.subscription_plans.max_active_reminder_tasks is
  'Maximum distinct tasks with at least one active reminder in a workspace.';
comment on column public.subscription_plans.max_reminders_per_task is
  'Maximum active reminder schedules attached to one task.';

create trigger subscription_plans_set_updated_at
before update on public.subscription_plans
for each row execute function private.set_updated_at();

commit;
