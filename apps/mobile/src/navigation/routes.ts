export const mobileRoutes = {
  dashboard: '/(tabs)/dashboard',
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
