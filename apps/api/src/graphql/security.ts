import {
  GraphQLError,
  Kind,
  type FragmentDefinitionNode,
  type SelectionNode,
  type ValidationRule,
} from 'graphql';

export function createMaxDepthRule(maxDepth: number): ValidationRule {
  return (context) => ({
    OperationDefinition(operation) {
      const fragments = new Map(
        context
          .getDocument()
          .definitions.filter(
            (definition) => definition.kind === Kind.FRAGMENT_DEFINITION,
          )
          .map((fragment) => [fragment.name.value, fragment]),
      );

      const depth = selectionDepth(
        operation.selectionSet.selections,
        fragments,
        new Set(),
      );
      if (depth > maxDepth) {
        context.reportError(
          new GraphQLError(`Operation exceeds maximum depth of ${maxDepth}.`, {
            extensions: { code: 'QUERY_TOO_COMPLEX' },
            nodes: operation,
          }),
        );
      }
      return false;
    },
  });
}

function selectionDepth(
  selections: readonly SelectionNode[],
  fragments: Map<string, FragmentDefinitionNode>,
  visitedFragments: Set<string>,
): number {
  let maximum = 0;

  for (const selection of selections) {
    if (selection.kind === Kind.FRAGMENT_SPREAD && selection.name) {
      if (visitedFragments.has(selection.name.value)) continue;
      const fragment = fragments.get(selection.name.value);
      if (!fragment) continue;
      const visited = new Set(visitedFragments).add(selection.name.value);
      maximum = Math.max(
        maximum,
        selectionDepth(fragment.selectionSet.selections, fragments, visited),
      );
      continue;
    }

    let childDepth = 0;
    if (selection.kind === Kind.INLINE_FRAGMENT) {
      childDepth = selectionDepth(
        selection.selectionSet.selections,
        fragments,
        visitedFragments,
      );
    } else if (selection.kind === Kind.FIELD && selection.selectionSet) {
      childDepth = selectionDepth(
        selection.selectionSet.selections,
        fragments,
        visitedFragments,
      );
    }
    maximum = Math.max(maximum, 1 + childDepth);
  }

  return maximum;
}
