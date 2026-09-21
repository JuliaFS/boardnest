import { describe, expect, it } from 'vitest';

import type { TaskSummary } from '../core/graphql';
import { positionAt } from './task-order';

describe('fractional task ordering', () => {
  it('places a task midway between its neighbors', () => {
    expect(
      positionAt([task('a', 1000), task('moved', 9000), task('b', 2000)], 1),
    ).toBe(1500);
  });

  it('adds space after the final task', () => {
    expect(positionAt([task('a', 1000), task('moved', 9000)], 1)).toBe(2000);
  });

  it('uses the default position for an empty destination', () => {
    expect(positionAt([task('moved', 9000)], 0)).toBe(1000);
  });
});

function task(id: string, position: number): TaskSummary {
  return {
    description: null,
    dueAt: null,
    id,
    position,
    priority: 'MEDIUM',
    projectId: 'project-id',
    statusId: 'status-id',
    title: id,
    updatedAt: '2026-09-21T00:00:00.000Z',
  };
}
