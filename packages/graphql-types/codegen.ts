import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: '../../apps/api/src/graphql/schema.ts',
  documents: 'src/operations/**/*.graphql',
  generates: {
    'src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-operations', 'typed-document-node'],
      config: {
        enumsAsTypes: true,
        scalars: {
          ID: { input: 'string', output: 'string' },
          String: { input: 'string', output: 'string' },
          Boolean: { input: 'boolean', output: 'boolean' },
          Int: { input: 'number', output: 'number' },
          Float: { input: 'number', output: 'number' },
          JSON: {
            input: 'Record<string, unknown>',
            output: 'Record<string, unknown>',
          },
        },
        useTypeImports: true,
      },
    },
  },
  ignoreNoDocuments: false,
};

export default config;
