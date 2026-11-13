# `@boardnest/graphql-types`

This private workspace is the shared GraphQL contract boundary for the Boardnest web and mobile clients. It generates schema types, input types, enum unions, operation result types, variable types, and precompiled `TypedDocumentNode` values from the API schema and checked-in operations.

## Ownership

- The executable schema remains in `apps/api/src/graphql/schema.ts`.
- Shared client operations belong in `src/operations` as named `.graphql` documents.
- Generated schema types belong in `src/generated/schema.ts`; generated
  operation types and documents belong in `src/generated/graphql.ts`. Both are
  committed.
- Consumers import only from `@boardnest/graphql-types`, never from the generated file directly.
- Platform-specific Apollo setup stays inside `apps/web` and `apps/mobile`.

The package contains generated mobile documents for authentication context,
workspaces, projects, tasks, realtime signals, notifications, push devices, and
invitations. The web Apollo transport test also uses `MobileConnection`. Web
business documents and response interfaces currently remain in
`apps/web/src/features/core/graphql.ts`; sharing the API schema does not mean
all client operations are already deduplicated. Move consumers together when
consolidating an operation.

## Generate contracts

From the repository root:

```bash
pnpm graphql:generate
```

Run generation after changing the API schema or a shared operation. Review and commit the generated diff.

## Verify generated output

```bash
pnpm graphql:check
pnpm --filter @boardnest/graphql-types typecheck
pnpm --filter @boardnest/graphql-types test
```

`graphql:check` uses GraphQL Code Generator dry-run mode. It fails when the committed output no longer matches the API schema or operation documents, so schema drift is caught in CI.

## Adding an operation

1. Add a named `.graphql` file under `src/operations`.
2. Run `pnpm graphql:generate`.
3. Import the generated document and types from `@boardnest/graphql-types`.
4. Remove any replaced handwritten document or response type from the client.
5. Run `pnpm graphql:check`, type-checking, and relevant client tests.

Do not hand-edit files in `src/generated`.
