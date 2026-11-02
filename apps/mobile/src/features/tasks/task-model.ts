import type { TaskPriority } from '@boardnest/graphql-types';

export const taskPriorities: readonly TaskPriority[] = [
  'LOW',
  'MEDIUM',
  'HIGH',
  'URGENT',
];

export function parseDueAt(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = new Date(normalized.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function canEditTasks(
  workspaceRole: string | undefined,
  projectRole: string | undefined,
  visibility: string,
) {
  if (workspaceRole === 'OWNER' || workspaceRole === 'ADMIN') return true;
  if (workspaceRole !== 'MEMBER') return false;
  if (projectRole === 'VIEWER') return false;
  return (
    visibility === 'WORKSPACE' ||
    projectRole === 'PROJECT_LEAD' ||
    projectRole === 'MEMBER'
  );
}
