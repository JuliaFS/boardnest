begin;

-- Application-safe user data. Credentials remain exclusively in auth.users.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),

  constraint profiles_display_name_length_check
    check (char_length(btrim(display_name)) between 1 and 80),
  constraint profiles_avatar_url_length_check
    check (avatar_url is null or char_length(avatar_url) <= 2048),
  constraint profiles_timezone_length_check
    check (char_length(btrim(timezone)) between 1 and 100)
);

alter table public.profiles enable row level security;

comment on table public.profiles is
  'Public application profile linked one-to-one to a Supabase Auth user.';
comment on column public.profiles.id is
  'The matching auth.users primary key; no password data is stored here.';

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inferred_name text;
begin
  inferred_name := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'Boardnest user'
  );

  insert into public.profiles (id, display_name)
  values (new.id, left(inferred_name, 80));

  return new;
end;
$$;

revoke execute on function private.handle_new_auth_user() from public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

commit;
