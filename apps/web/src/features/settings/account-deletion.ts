import type { AccountDeletionImpact } from '../auth/auth-client';

export function isDeletionPlanComplete(
  impact: AccountDeletionImpact,
  transfers: Record<string, string>,
  deleteWorkspaceIds: ReadonlySet<string>,
): boolean {
  return impact.ownedWorkspaces.every((workspace) => {
    if (workspace.ownershipStatus === 'transfer_required') {
      return Boolean(transfers[workspace.id]);
    }
    if (workspace.ownershipStatus === 'deletion_required') {
      return deleteWorkspaceIds.has(workspace.id);
    }
    return true;
  });
}
