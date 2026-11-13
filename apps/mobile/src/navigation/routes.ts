export const mobileRoutes = {
  dashboard: '/(tabs)/dashboard',
  invitation(token: string) {
    return `/invite/${encodeURIComponent(token)}` as const;
  },
  login: '/(auth)/login',
  notifications: '/(tabs)/notifications',
  project(projectId: string) {
    return `/projects/${encodeURIComponent(projectId)}` as const;
  },
  board(projectId: string) {
    return `/projects/${encodeURIComponent(projectId)}/board` as const;
  },
  projects: '/(tabs)/projects',
  settings: '/(tabs)/settings',
  task(projectId: string, taskId: string) {
    return `/projects/${encodeURIComponent(projectId)}/tasks/${encodeURIComponent(taskId)}` as const;
  },
  workspace(workspaceId: string) {
    return `/workspaces/${encodeURIComponent(workspaceId)}` as const;
  },
} as const;

export function invitationRouteFromReturnTo(value: unknown) {
  if (typeof value !== 'string') return null;
  const match =
    /^\/invite\/([A-Za-z0-9_-]{43}|[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(
      value,
    );
  const token = match?.[1];
  return token ? mobileRoutes.invitation(token) : null;
}
