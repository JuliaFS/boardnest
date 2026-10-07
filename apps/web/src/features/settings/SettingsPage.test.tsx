import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { AccountDeletionImpact } from '../auth/auth-client';
import { SettingsPage } from './SettingsPage';

const mocks = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  getAccountDeletionImpact: vi.fn(),
}));

vi.mock('../auth/auth-client', () => ({
  getAccountDeletionImpact: mocks.getAccountDeletionImpact,
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => ({
    deleteAccount: mocks.deleteAccount,
    user: {
      displayName: 'Delete Owner',
      email: 'owner@example.com',
      id: '00000000-0000-4000-8000-000000000051',
      isAnonymous: false,
    },
  }),
}));

const impact: AccountDeletionImpact = {
  ownedWorkspaces: [
    {
      eligibleSuccessors: [
        {
          displayName: 'Next Owner',
          id: '00000000-0000-4000-8000-000000000052',
          role: 'member',
        },
      ],
      id: '10000000-0000-4000-8000-000000000051',
      memberCount: 2,
      name: 'Shared workspace',
      ownershipStatus: 'transfer_required',
      projectCount: 2,
      taskCount: 5,
    },
    {
      eligibleSuccessors: [],
      id: '10000000-0000-4000-8000-000000000052',
      memberCount: 1,
      name: 'Personal workspace',
      ownershipStatus: 'deletion_required',
      projectCount: 1,
      taskCount: 3,
    },
  ],
  userId: '00000000-0000-4000-8000-000000000051',
};

afterEach(cleanup);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAccountDeletionImpact.mockResolvedValue(impact);
  mocks.deleteAccount.mockResolvedValue(undefined);
});

describe('SettingsPage account deletion', () => {
  it('requires every ownership decision and exact confirmation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    const button = await screen.findByRole('button', {
      name: 'Permanently delete account',
    });
    expect(button.hasAttribute('disabled')).toBe(true);

    await user.selectOptions(
      screen.getByLabelText('Transfer ownership to'),
      '00000000-0000-4000-8000-000000000052',
    );
    await user.click(
      screen.getByLabelText(
        'Permanently delete this personal workspace and all of its projects and tasks.',
      ),
    );
    await user.type(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');

    expect(button.hasAttribute('disabled')).toBe(false);
    await user.click(button);

    expect(mocks.deleteAccount).toHaveBeenCalledWith({
      confirmation: 'DELETE',
      deleteWorkspaceIds: ['10000000-0000-4000-8000-000000000052'],
      transfers: {
        '10000000-0000-4000-8000-000000000051':
          '00000000-0000-4000-8000-000000000052',
      },
    });
  });

  it('shows a retryable error when the ownership preview cannot load', async () => {
    mocks.getAccountDeletionImpact.mockRejectedValueOnce(
      new Error('Preview unavailable'),
    );

    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Preview unavailable',
    );
  });
});
