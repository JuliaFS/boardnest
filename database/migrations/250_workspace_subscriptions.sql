begin;

-- Billing state is workspace-scoped so every member receives the same capabilities.
create table public.workspace_subscriptions (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  plan_code text not null references public.subscription_plans (code) on update cascade,
  status text not null default 'active',
  provider text not null default 'manual',
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  constraint workspace_subscriptions_status_check
    check (status in ('active', 'trialing', 'past_due', 'canceled')),
  constraint workspace_subscriptions_provider_check
    check (provider in ('manual', 'stripe')),
  constraint workspace_subscriptions_customer_length_check
    check (provider_customer_id is null or char_length(provider_customer_id) <= 255),
  constraint workspace_subscriptions_subscription_length_check
    check (provider_subscription_id is null or char_length(provider_subscription_id) <= 255),
  constraint workspace_subscriptions_period_check
    check (
      current_period_start is null
      or current_period_end is null
      or current_period_end > current_period_start
    ),
  constraint workspace_subscriptions_provider_fields_check
    check (
      provider = 'stripe'
      or (provider_customer_id is null and provider_subscription_id is null)
    )
);

alter table public.workspace_subscriptions enable row level security;

create unique index workspace_subscriptions_provider_subscription_unique_idx
  on public.workspace_subscriptions (provider_subscription_id)
  where provider_subscription_id is not null;
create index workspace_subscriptions_plan_status_idx
  on public.workspace_subscriptions (plan_code, status);

create trigger workspace_subscriptions_set_updated_at
before update on public.workspace_subscriptions
for each row execute function private.set_updated_at();

create function private.default_workspace_plan(target_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when coalesce(au.is_anonymous, false) then 'guest'
    else 'free'
  end
  from auth.users as au
  where au.id = target_user_id
$$;

create function private.add_default_workspace_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  default_plan text;
begin
  default_plan := private.default_workspace_plan(new.created_by);

  if default_plan is null then
    raise exception 'Workspace creator does not have an Auth user'
      using errcode = '23503';
  end if;

  insert into public.workspace_subscriptions (workspace_id, plan_code)
  values (new.id, default_plan);

  return new;
end;
$$;

revoke execute on function private.default_workspace_plan(uuid) from public;
revoke execute on function private.add_default_workspace_subscription() from public;

create trigger workspaces_add_default_subscription
after insert on public.workspaces
for each row execute function private.add_default_workspace_subscription();

-- Existing workspaces receive the correct baseline plan when this migration is applied.
insert into public.workspace_subscriptions (workspace_id, plan_code)
select w.id, private.default_workspace_plan(w.created_by)
from public.workspaces as w
on conflict (workspace_id) do nothing;

comment on table public.workspace_subscriptions is
  'Current workspace plan and billing lifecycle state; managed only by trusted backend operations.';

commit;
