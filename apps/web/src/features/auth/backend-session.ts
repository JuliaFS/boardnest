import { publicEnvironment } from '../../lib/env';

export interface BackendUser {
  email: string | null;
  id: string;
  role: 'authenticated';
}

export async function verifyBackendSession(
  accessToken: string,
  signal?: AbortSignal,
): Promise<BackendUser> {
  const response = await fetch(`${publicEnvironment.VITE_API_URL}/auth/me`, {
    headers: { authorization: `Bearer ${accessToken}` },
    ...(signal ? { signal } : {}),
  });

  if (!response.ok) {
    throw new Error('The API could not verify this session.');
  }

  const body = (await response.json()) as { user: BackendUser };
  return body.user;
}
