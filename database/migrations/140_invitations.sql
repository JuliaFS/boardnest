begin;

-- Tokens are stored only as SHA-256 hashes; raw invitation tokens never persist.
create table public.invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role text not null default 'member',
  status text not null default 'pending',
  token_hash text not null,
  invited_by uuid references public.profiles (id) on delete set null,
  accepted_by uuid references public.profiles (id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  constraint invitations_email_format_check
    check (
      email = lower(btrim(email))
      and char_length(email) between 3 and 320
      and position('@' in email) > 1
    ),
  constraint invitations_role_check
    check (role in ('admin', 'member', 'viewer')),
  constraint invitations_status_check
    check (status in ('pending', 'accepted', 'revoked', 'expired')),
  constraint invitations_token_hash_check
    check (token_hash ~ '^[a-f0-9]{64}$'),
  constraint invitations_expiry_check
    check (expires_at > created_at),
  constraint invitations_state_check
    check (
      (status = 'pending' and accepted_by is null and accepted_at is null and revoked_at is null)
      or (status = 'accepted' and accepted_by is not null and accepted_at is not null and revoked_at is null)
      or (status = 'revoked' and accepted_by is null and accepted_at is null and revoked_at is not null)
      or (status = 'expired' and accepted_by is null and accepted_at is null and revoked_at is null)
    )
);

alter table public.invitations enable row level security;

create unique index invitations_token_hash_unique_idx
  on public.invitations (token_hash);
create unique index invitations_workspace_pending_email_unique_idx
  on public.invitations (workspace_id, lower(email))
  where status = 'pending';
create index invitations_workspace_status_idx
  on public.invitations (workspace_id, status, created_at desc);
create index invitations_pending_expiry_idx
  on public.invitations (expires_at)
  where status = 'pending';

comment on table public.invitations is
  'Email invitation that can exist before the recipient creates an account.';

create trigger invitations_set_updated_at
before update on public.invitations
for each row execute function private.set_updated_at();

commit;
