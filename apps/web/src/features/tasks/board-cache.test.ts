import { InMemoryCache } from '@apollo/client';
import { describe, expect, it } from 'vitest';

import { BOARD_QUERY, type BoardData, type TaskSummary } from '../core/graphql';
import { removeBoardTask, upsertBoardTask } from './board-cache';

const task: TaskSummary = {
  id: 'task-1',
  projectId: 'project-1',
  statusId: 'todo',
  title: 'First task',
  description: null,
  priority: 'MEDIUM',
  position: 1000,
  dueAt: null,
  updatedAt: '2026-11-13T00:00:00Z',
};

function seedBoard(cache: InMemoryCache, projectId = task.projectId) {
  cache.writeQuery<BoardData>({
    query: BOARD_QUERY,
    variables: { projectId },
    data: {
      taskStatuses: [],
      tasks: {
        nodes: [],
        pageInfo: { hasNextPage: false, limit: 100, offset: 0 },
      },
    },
  });
}

function readBoard(cache: InMemoryCache, projectId = task.projectId) {
  return cache.readQuery<BoardData>({
    query: BOARD_QUERY,
    variables: { projectId },
  });
}

describe('board cache updates', () => {
  it('adds a mutation result once even when the subscription delivers it again', () => {
    const cache = new InMemoryCache();
    seedBoard(cache);
    seedBoard(cache, 'other-project');

    upsertBoardTask(cache, task);
    upsertBoardTask(cache, task);

    expect(readBoard(cache)?.tasks.nodes).toEqual([task]);
    expect(readBoard(cache, 'other-project')?.tasks.nodes).toEqual([]);
    expect(readBoard(cache)?.tasks.pageInfo).toEqual({
      hasNextPage: false,
      limit: 100,
      offset: 0,
    });
  });

  it('applies a confirmed move and edit without losing other tasks', () => {
    const cache = new InMemoryCache();
    seedBoard(cache);
    upsertBoardTask(cache, task);
    const other = { ...task, id: 'task-2' };
    upsertBoardTask(cache, other);
    const moved = {
      ...task,
      statusId: 'done',
      position: 2000,
      title: 'Updated',
    };

    upsertBoardTask(cache, moved);
    upsertBoardTask(cache, moved);

    expect(readBoard(cache)?.tasks.nodes).toEqual([moved, other]);
    removeBoardTask(cache, task.projectId, task.id);
    removeBoardTask(cache, task.projectId, task.id);
    expect(readBoard(cache)?.tasks.nodes).toEqual([other]);
  });

  it('does not create incomplete cached boards before their query loads', () => {
    const cache = new InMemoryCache();
    upsertBoardTask(cache, task);
    removeBoardTask(cache, task.projectId, task.id);
    expect(readBoard(cache)).toBeNull();
  });
});
