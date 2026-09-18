begin;

-- Keep extension-owned objects outside the exposed public schema.
create schema if not exists extensions;
create schema if not exists private;

revoke all on schema private from public;
revoke all on schema extensions from public;

create extension if not exists pgcrypto with schema extensions;

comment on schema private is
  'Non-exposed helper functions used by triggers and row-level security.';

commit;
