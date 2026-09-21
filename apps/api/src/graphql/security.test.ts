import { buildSchema, parse, validate } from 'graphql';
import { describe, expect, it } from 'vitest';

import { createMaxDepthRule } from './security.js';

const schema = buildSchema(`
  type Node { child: Node, value: String }
  type Query { root: Node }
`);

describe('GraphQL query depth', () => {
  it('accepts an operation at the configured depth', () => {
    const document = parse('{ root { child { value } } }');

    expect(validate(schema, document, [createMaxDepthRule(3)])).toEqual([]);
  });

  it('rejects an operation over the configured depth', () => {
    const document = parse('{ root { child { child { value } } } }');
    const errors = validate(schema, document, [createMaxDepthRule(3)]);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.extensions.code).toBe('QUERY_TOO_COMPLEX');
  });
});
