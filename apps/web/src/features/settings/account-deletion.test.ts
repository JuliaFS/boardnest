import { describe, expect, it } from 'vitest';

import type { AccountDeletionImpact } from '../auth/auth-client';
import { isDeletionPlanComplete } from './account-deletion';

const impact: AccountDeletionImpact = {
  ownedWorkspaces: [
    {
      eligibleSuccessors: [
        {
          displayName: 'Next Owner',
          id: '00000000-0000-4000-8000-000000000002',
          role: 'member',
        },
      ],
      id: '10000000-0000-4000-8000-000000000001',
      memberCount: 2,
      name: 'Shared',
      ownershipStatus: 'transfer_required',
      projectCount: 1,
      taskCount: 5,
    },
    {
      eligibleSuccessors: [],
      id: '10000000-0000-4000-8000-000000000002',
      memberCount: 1,
      name: 'Personal',
      ownershipStatus: 'deletion_required',
      projectCount: 2,
      taskCount: 8,
    },
  ],
  userId: '00000000-0000-4000-8000-000000000001',
};

describe('account deletion plan', () => {
  it('requires both ownership transfer and personal workspace confirmation', () => {
    expect(isDeletionPlanComplete(impact, {}, new Set())).toBe(false);
    expect(
      isDeletionPlanComplete(
        impact,
        {
          '10000000-0000-4000-8000-000000000001':
            '00000000-0000-4000-8000-000000000002',
        },
        new Set(),
      ),
    ).toBe(false);
    expect(
      isDeletionPlanComplete(
        impact,
        {
          '10000000-0000-4000-8000-000000000001':
            '00000000-0000-4000-8000-000000000002',
        },
        new Set(['10000000-0000-4000-8000-000000000002']),
      ),
    ).toBe(true);
  });
});
