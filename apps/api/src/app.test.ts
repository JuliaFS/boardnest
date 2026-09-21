import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

import type { Session } from '@supabase/supabase-js';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createServer } from './app.js';
import type { AuthService, PublicAuthUser } from './auth/auth-service.js';

const origin = 'http://localhost:5173';
const user: PublicAuthUser = {
  displayName: 'Test User',
  email: 'person@example.com',
  id: '4ac60f36-9f7a-419f-b447-d8f9d2bc7cd8',
  role: 'authenticated',
};
const session = {
  access_token: 'access-token',
  expires_in: 3600,
  refresh_token: 'refresh-token',
  token_type: 'bearer',
  user: {
    app_metadata: {},
    aud: 'authenticated',
    created_at: new Date(0).toISOString(),
    id: user.id,
    user_metadata: { display_name: user.displayName },
  },
} as Session;

const servers = new Set<ReturnType<typeof createServer>>();

afterEach(async () => {
  await Promise.all(
    [...servers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
  servers.clear();
});

function createAuthService(): AuthService {
  return {
    completeConfirmation: vi.fn().mockResolvedValue({ session, user }),
    login: vi.fn().mockResolvedValue({ session, user }),
    refresh: vi.fn().mockResolvedValue({ session, user }),
    register: vi.fn().mockResolvedValue({
      confirmationRequired: true,
      result: null,
    }),
    signOut: vi.fn().mockResolvedValue(undefined),
    verify: vi.fn().mockResolvedValue(user),
  };
}

function startServer(authService = createAuthService()) {
  const server = createServer({
    authService,
    corsOrigin: origin,
    secureCookies: false,
  });
  servers.add(server);
  server.listen(0, '127.0.0.1');
  return { authService, server };
}

async function getUrl(server: ReturnType<typeof createServer>, path: string) {
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}${path}`;
}

describe('API server', () => {
  it('reports service health', async () => {
    const { server } = startServer();
    const response = await fetch(await getUrl(server, '/health'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      service: 'boardnest-api',
      status: 'ok',
    });
  });

  it('sets HttpOnly cookies without returning tokens on login', async () => {
    const { server } = startServer();
    const response = await fetch(await getUrl(server, '/auth/login'), {
      body: JSON.stringify({
        email: 'person@example.com',
        password: 'StrongPass1',
      }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    });
    const body = (await response.json()) as Record<string, unknown>;
    const cookies = response.headers.getSetCookie();

    expect(response.status).toBe(200);
    expect(body).toEqual({ user });
    expect(JSON.stringify(body)).not.toContain('access-token');
    expect(cookies).toHaveLength(2);
    expect(cookies.every((cookie) => cookie.includes('HttpOnly'))).toBe(true);
    expect(cookies.every((cookie) => cookie.includes('SameSite=Lax'))).toBe(
      true,
    );
  });

  it('rejects cross-origin auth mutations', async () => {
    const { authService, server } = startServer();
    const response = await fetch(await getUrl(server, '/auth/login'), {
      body: JSON.stringify({ email: 'person@example.com', password: 'secret' }),
      headers: {
        'content-type': 'application/json',
        origin: 'https://attacker.example',
      },
      method: 'POST',
    });

    expect(response.status).toBe(403);
    expect(authService.login).not.toHaveBeenCalled();
  });

  it('authenticates a session from the HttpOnly access cookie', async () => {
    const { authService, server } = startServer();
    const response = await fetch(await getUrl(server, '/auth/session'), {
      headers: { cookie: 'boardnest-access=access-token' },
    });

    expect(response.status).toBe(200);
    expect(authService.verify).toHaveBeenCalledWith('access-token');
    await expect(response.json()).resolves.toEqual({ user });
  });

  it('rotates cookies through the refresh token when access is invalid', async () => {
    const authService = createAuthService();
    vi.mocked(authService.verify).mockRejectedValue(new Error('expired'));
    const { server } = startServer(authService);
    const response = await fetch(await getUrl(server, '/auth/session'), {
      headers: {
        cookie:
          'boardnest-access=expired-token; boardnest-refresh=refresh-token',
      },
    });

    expect(response.status).toBe(200);
    expect(authService.refresh).toHaveBeenCalledWith('refresh-token');
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });

  it('completes the PKCE callback and redirects with session cookies', async () => {
    const { authService, server } = startServer();
    const response = await fetch(
      await getUrl(server, '/auth/callback?code=one-time-code'),
      { redirect: 'manual' },
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${origin}/dashboard`);
    expect(authService.completeConfirmation).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'one-time-code' }),
    );
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });

  it('clears both cookies on logout', async () => {
    const { authService, server } = startServer();
    const response = await fetch(await getUrl(server, '/auth/logout'), {
      headers: {
        cookie: 'boardnest-access=access; boardnest-refresh=refresh',
        origin,
      },
      method: 'POST',
    });

    expect(response.status).toBe(204);
    expect(authService.signOut).toHaveBeenCalledWith('access', 'refresh');
    expect(
      response.headers
        .getSetCookie()
        .every((cookie) => cookie.includes('Max-Age=0')),
    ).toBe(true);
  });
});
