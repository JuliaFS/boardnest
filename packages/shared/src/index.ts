export const workspaceRoles = ['owner', 'admin', 'member', 'viewer'] as const;

export type WorkspaceRole = (typeof workspaceRoles)[number];

export function isWorkspaceRole(value: string): value is WorkspaceRole {
  return workspaceRoles.some((role) => role === value);
}
