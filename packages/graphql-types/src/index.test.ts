import { Kind, OperationTypeNode } from 'graphql';
import { describe, expect, it } from 'vitest';

import { MobileConnectionDocument } from './index';

describe('shared GraphQL contracts', () => {
  it('exports a typed public mobile connection query', () => {
    const operation = MobileConnectionDocument.definitions.find(
      (definition) => definition.kind === Kind.OPERATION_DEFINITION,
    );

    expect(operation).toMatchObject({
      kind: Kind.OPERATION_DEFINITION,
      name: { value: 'MobileConnection' },
      operation: OperationTypeNode.QUERY,
    });
  });
});
