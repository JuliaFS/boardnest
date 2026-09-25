# `@boardnest/graphql-types`

This private workspace reserves a future GraphQL code-generation boundary. The
current application keeps operation result types beside the frontend operations
and domain types beside the API schema. It intentionally contains no handwritten
placeholder contract and is not imported by either runtime.

If code generation is introduced, generate from the checked-in schema and web
operations, make generation reproducible in CI, and replace duplicated manual
operation types rather than creating a third competing domain model.
