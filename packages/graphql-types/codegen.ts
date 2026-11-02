import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: '../../apps/api/src/graphql/schema.ts',
  documents: 'src/operations/**/*.graphql',
  generates: {
    'src/generated/schema.ts': {
      plugins: ['typescript'],
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
    'src/generated/graphql.ts': {
      plugins: ['typescript-operations', 'typed-document-node'],
      config: {
        importSchemaTypesFrom: './src/generated/schema',
        preResolveTypes: false,
        useTypeImports: true,
      },
    },
  },
  ignoreNoDocuments: false,
};

export default config;
