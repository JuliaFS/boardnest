import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const successorSchema = z.object({
  displayName: z.string(),
  id: z.uuid(),
  role: z.enum(['admin', 'member', 'owner', 'viewer']),
});

const ownedWorkspaceSchema = z.object({
  eligibleSuccessors: z.array(successorSchema),
  id: z.uuid(),
  memberCount: z.number().int().positive(),
  name: z.string(),
  ownershipStatus: z.enum([
    'deletion_required',
    'shared_owner',
    'transfer_required',
  ]),
  projectCount: z.number().int().nonnegative(),
  taskCount: z.number().int().nonnegative(),
});

const impactSchema = z.object({
  ownedWorkspaces: z.array(ownedWorkspaceSchema),
  userId: z.uuid(),
});

export type AccountDeletionImpact = z.infer<typeof impactSchema>;

export interface AccountDeletionInput {
  deleteWorkspaceIds: string[];
  transfers: Record<string, string>;
}

export interface AccountDeletionService {
  deleteAccount: (userId: string, input: AccountDeletionInput) => Promise<void>;
  impact: (userId: string) => Promise<AccountDeletionImpact>;
}

export function createSupabaseAccountDeletionService(options: {
  serviceRoleKey: string;
  supabaseUrl: string;
}): AccountDeletionService {
  const client = createClient(options.supabaseUrl, options.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  return {
    async deleteAccount(userId, input) {
      const preparation = await client.rpc('prepare_account_deletion', {
        p_delete_workspace_ids: input.deleteWorkspaceIds,
        p_transfers: input.transfers,
        p_user_id: userId,
      });
      if (preparation.error) {
        throw new AccountDeletionError(preparation.error.message, 409);
      }

      const deletion = await client.auth.admin.deleteUser(userId, false);
      if (deletion.error) {
        throw new AccountDeletionError(
          'The account data was prepared, but Supabase Auth could not delete the user. Remove owned Storage objects and try again.',
          409,
        );
      }
    },

    async impact(userId) {
      const response = await client.rpc('account_deletion_impact', {
        p_user_id: userId,
      });
      if (response.error)
        throw new AccountDeletionError(response.error.message);
      return impactSchema.parse(response.data);
    },
  };
}

export class AccountDeletionError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
    this.name = 'AccountDeletionError';
  }
}
