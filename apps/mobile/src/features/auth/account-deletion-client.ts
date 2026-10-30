import { mobileEnvironment } from '@/lib/environment';
import { mobileSupabase } from '@/lib/supabase';

export type AccountDeletionSuccessor = {
  displayName: string;
  id: string;
  role: 'admin' | 'member' | 'owner' | 'viewer';
};

export type AccountDeletionWorkspace = {
  eligibleSuccessors: AccountDeletionSuccessor[];
  id: string;
  memberCount: number;
  name: string;
  ownershipStatus: 'deletion_required' | 'shared_owner' | 'transfer_required';
  projectCount: number;
  taskCount: number;
};

export type AccountDeletionImpact = {
  ownedWorkspaces: AccountDeletionWorkspace[];
  userId: string;
};

export async function getAccountDeletionImpact(): Promise<AccountDeletionImpact> {
  const result = await request<{ impact: AccountDeletionImpact }>(
    '/auth/account-deletion',
    { method: 'GET' },
  );
  return result.impact;
}

export async function deleteMobileAccount(input: {
  confirmation: 'DELETE';
  deleteWorkspaceIds: string[];
  transfers: Record<string, string>;
}): Promise<void> {
  await request('/auth/account-deletion', {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const { data } = await mobileSupabase.auth.getSession();
  const accessToken = data.session?.access_token;
  if (!accessToken) throw new Error('Authentication required.');

  const response = await fetch(`${mobileEnvironment.apiUrl}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(body?.error ?? 'The account request failed.');
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
