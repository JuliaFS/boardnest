import { Kind, OperationTypeNode } from 'graphql';
import { describe, expect, it } from 'vitest';

import {
  MobileConnectionDocument,
  MobileBoardDocument,
  MobileProjectDetailsDocument,
  MobileProjectsDocument,
  MobileWorkspaceDetailsDocument,
  MobileWorkspacesDocument,
  MobileTaskDetailsDocument,
  UpdateMobileWorkspaceDocument,
} from './index';

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

  it.each([
    ['MobileWorkspaces', MobileWorkspacesDocument, OperationTypeNode.QUERY],
    [
      'MobileWorkspaceDetails',
      MobileWorkspaceDetailsDocument,
      OperationTypeNode.QUERY,
    ],
    [
      'UpdateMobileWorkspace',
      UpdateMobileWorkspaceDocument,
      OperationTypeNode.MUTATION,
    ],
    ['MobileProjects', MobileProjectsDocument, OperationTypeNode.QUERY],
    ['MobileBoard', MobileBoardDocument, OperationTypeNode.QUERY],
    ['MobileTaskDetails', MobileTaskDetailsDocument, OperationTypeNode.QUERY],
    [
      'MobileProjectDetails',
      MobileProjectDetailsDocument,
      OperationTypeNode.QUERY,
    ],
  ])('exports the typed %s operation', (name, document, operationType) => {
    const operation = document.definitions.find(
      (definition) => definition.kind === Kind.OPERATION_DEFINITION,
    );

    expect(operation).toMatchObject({
      kind: Kind.OPERATION_DEFINITION,
      name: { value: name },
      operation: operationType,
    });
  });
});
