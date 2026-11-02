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
  const match = /^\/invite\/([A-Za-z0-9_-]{43})$/.exec(value);
  const token = match?.[1];
  return token ? mobileRoutes.invitation(token) : null;
}
