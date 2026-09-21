import type { TaskSummary } from '../core/graphql';

export function positionAt(tasks: TaskSummary[], index: number): number {
  const previous = tasks[index - 1]?.position;
  const next = tasks[index + 1]?.position;
  if (previous !== undefined && next !== undefined)
    return (previous + next) / 2;
  if (previous !== undefined) return previous + 1000;
  if (next !== undefined) return Math.max(0, next / 2);
  return 1000;
}
