import { publicEnvironment } from '../../lib/env';

export interface AuthUser {
  displayName: string | null;
  email: string | null;
  id: string;
  isAnonymous: boolean;
  role: 'authenticated';
}

interface AuthResponse {
  user: AuthUser;
}

let pendingSessionRequest: Promise<AuthUser | null> | null = null;

export function getSession(): Promise<AuthUser | null> {
  pendingSessionRequest ??= request<AuthResponse>('/auth/session', {
    method: 'GET',
  })
    .then((body) => body.user)
    .catch((error: unknown) => {
      if (error instanceof AuthRequestError && error.status === 401)
        return null;
      throw error;
    })
    .finally(() => {
      pendingSessionRequest = null;
    });

  return pendingSessionRequest;
}

export async function login(
  email: string,
  password: string,
): Promise<AuthUser> {
  const body = await request<AuthResponse>('/auth/login', {
    body: JSON.stringify({ email, password }),
    method: 'POST',
  });
  return body.user;
}

export async function continueAsGuest(captchaToken: string): Promise<AuthUser> {
  const body = await request<AuthResponse>('/auth/guest', {
    body: JSON.stringify({ captchaToken }),
    method: 'POST',
  });
  return body.user;
}

export async function register(input: {
  displayName: string;
  email: string;
  password: string;
}): Promise<{ confirmationRequired: boolean; user: AuthUser | null }> {
  return request('/auth/register', {
    body: JSON.stringify(input),
    method: 'POST',
  });
}

export async function logout(): Promise<void> {
  await request<undefined>('/auth/logout', { method: 'POST' });
}

class AuthRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthRequestError';
    this.status = status;
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${publicEnvironment.VITE_API_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'content-type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new AuthRequestError(
      body?.error ?? 'Authentication request failed.',
      response.status,
    );
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}
