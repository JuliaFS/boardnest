begin;

-- Reused by mutable tables so updated_at is controlled by the database.
create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

revoke execute on function private.set_updated_at() from public;

comment on function private.set_updated_at() is
  'Sets updated_at whenever a mutable row is updated.';

commit;
