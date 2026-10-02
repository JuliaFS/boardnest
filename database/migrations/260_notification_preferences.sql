begin;

-- Preferences express user intent; plan capabilities still decide which channels are available.
create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default true,
  task_created_enabled boolean not null default true,
  task_assigned_enabled boolean not null default true,
  reminder_enabled boolean not null default true,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp()
);

alter table public.notification_preferences enable row level security;

create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function private.set_updated_at();

create function private.add_default_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke execute on function private.add_default_notification_preferences() from public;

create trigger profiles_add_default_notification_preferences
after insert on public.profiles
for each row execute function private.add_default_notification_preferences();

insert into public.notification_preferences (user_id)
select p.id
from public.profiles as p
on conflict (user_id) do nothing;

comment on table public.notification_preferences is
  'Per-user notification channel and event preferences; entitlements remain workspace-plan controlled.';

commit;
