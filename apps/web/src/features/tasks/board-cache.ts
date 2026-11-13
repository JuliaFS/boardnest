import type { ApolloCache } from '@apollo/client';

import { BOARD_QUERY, type BoardData, type TaskSummary } from '../core/graphql';

// Both mutation responses and subscription events update the same cached list.
// Do not create a partial board when its initial query has not loaded yet.
export function upsertBoardTask(cache: ApolloCache, task: TaskSummary): void {
  cache.updateQuery<BoardData>(
    { query: BOARD_QUERY, variables: { projectId: task.projectId } },
    (board) => {
      if (!board) return board;
      const existing = board.tasks.nodes.find(({ id }) => id === task.id);
      const nodes = existing
        ? board.tasks.nodes.map((current) =>
            current.id === task.id ? task : current,
          )
        : [...board.tasks.nodes, task];
      return { ...board, tasks: { ...board.tasks, nodes } };
    },
  );
}

export function removeBoardTask(
  cache: ApolloCache,
  projectId: string,
  taskId: string,
): void {
  cache.updateQuery<BoardData>(
    { query: BOARD_QUERY, variables: { projectId } },
    (board) => {
      if (!board) return board;
      return {
        ...board,
        tasks: {
          ...board.tasks,
          nodes: board.tasks.nodes.filter(({ id }) => id !== taskId),
        },
      };
    },
  );
}
