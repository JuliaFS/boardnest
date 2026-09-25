# `@boardnest/config`

This private workspace reserves the boundary for reusable tool configuration.
The current repository keeps TypeScript, ESLint, Prettier, and test conventions
at the root because extracting a package would add indirection without removing
meaningful duplication. Add exports here only when two consumers need the same
non-trivial preset.
