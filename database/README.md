# Boardnest database

Boardnest uses a SQL-first PostgreSQL schema hosted by Supabase.

## Phase 1 status

The database directories exist to establish repository ownership only. No migrations or seed data are created before the Phase 2 entity model and deletion semantics are reviewed.

## Migration contract

- Every table receives a separate, ordered SQL migration.
- Shared extensions and functions receive their own migrations.
- Foreign-key dependencies determine execution order.
- Each table migration defines keys, constraints, indexes, timestamps, and explicit `ON DELETE` behavior.
- RLS helper functions and policies are stored in dedicated SQL migrations after their dependent tables.
- Application source files must not contain schema-creation SQL.
- Migrations are immutable after they have been applied to a shared environment; changes require a new migration.
- Development seed data is separate from production-safe migrations.

The Phase 2 version of this document will include the text ERD, table purposes, relationships, migration order, and Supabase execution instructions.
