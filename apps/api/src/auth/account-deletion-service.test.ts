import { describe, expect, it, vi } from 'vitest';

import { createSupabaseAccountDeletionService } from './account-deletion-service.js';

const rpc = vi.fn();
const deleteUser = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { admin: { deleteUser } }, rpc }),
}));

describe('account deletion service', () => {
  it('prepares application data before deleting the Auth user', async () => {
    rpc.mockResolvedValueOnce({ data: {}, error: null });
    deleteUser.mockResolvedValueOnce({ data: {}, error: null });
    const service = createSupabaseAccountDeletionService({
      serviceRoleKey: 'secret',
      supabaseUrl: 'https://example.supabase.co',
    });
    const input = {
      deleteWorkspaceIds: ['10000000-0000-4000-8000-000000000001'],
      transfers: {
        '10000000-0000-4000-8000-000000000002':
          '00000000-0000-4000-8000-000000000002',
      },
    };

    await service.deleteAccount('00000000-0000-4000-8000-000000000001', input);

    expect(rpc).toHaveBeenCalledWith('prepare_account_deletion', {
      p_delete_workspace_ids: input.deleteWorkspaceIds,
      p_transfers: input.transfers,
      p_user_id: '00000000-0000-4000-8000-000000000001',
    });
    expect(deleteUser).toHaveBeenCalledWith(
      '00000000-0000-4000-8000-000000000001',
      false,
    );
    expect(rpc.mock.invocationCallOrder[0]).toBeLessThan(
      deleteUser.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('does not delete the Auth user when preparation fails', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Choose a new owner' },
    });
    const service = createSupabaseAccountDeletionService({
      serviceRoleKey: 'secret',
      supabaseUrl: 'https://example.supabase.co',
    });

    await expect(
      service.deleteAccount('00000000-0000-4000-8000-000000000001', {
        deleteWorkspaceIds: [],
        transfers: {},
      }),
    ).rejects.toThrow('Choose a new owner');
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('validates the impact returned by the trusted RPC', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        ownedWorkspaces: [
          {
            eligibleSuccessors: [],
            id: '10000000-0000-4000-8000-000000000001',
            memberCount: 1,
            name: 'Personal',
            ownershipStatus: 'deletion_required',
            projectCount: 2,
            taskCount: 5,
          },
        ],
        userId: '00000000-0000-4000-8000-000000000001',
      },
      error: null,
    });
    const service = createSupabaseAccountDeletionService({
      serviceRoleKey: 'secret',
      supabaseUrl: 'https://example.supabase.co',
    });

    await expect(
      service.impact('00000000-0000-4000-8000-000000000001'),
    ).resolves.toMatchObject({
      ownedWorkspaces: [{ ownershipStatus: 'deletion_required' }],
    });
  });

  it('does not expose a raw invalid API key error', async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid API key' },
    });
    const service = createSupabaseAccountDeletionService({
      serviceRoleKey: 'invalid',
      supabaseUrl: 'https://example.supabase.co',
    });

    await expect(
      service.impact('00000000-0000-4000-8000-000000000001'),
    ).rejects.toMatchObject({
      message:
        'Account deletion is temporarily unavailable because the server credential is invalid.',
      status: 503,
    });
  });
});
