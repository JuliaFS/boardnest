import { once } from 'node:events';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createServer } from './app.js';

const servers = new Set<ReturnType<typeof createServer>>();

afterEach(async () => {
  await Promise.all(
    [...servers].map(
      (server) =>
        new Promise<void>((resolve, reject) => {
          server.close((error) => {
            if (error) reject(error);
            else resolve();
          });
        }),
    ),
  );
  servers.clear();
});

function startServer(verifyAccessToken = vi.fn()) {
  const server = createServer({
    corsOrigin: 'http://localhost:5173',
    verifyAccessToken,
  });
  servers.add(server);
  server.listen(0, '127.0.0.1');
  return { server, verifyAccessToken };
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

  it('rejects an auth request without a bearer token', async () => {
    const { server, verifyAccessToken } = startServer();
    const response = await fetch(await getUrl(server, '/auth/me'));

    expect(response.status).toBe(401);
    expect(verifyAccessToken).not.toHaveBeenCalled();
  });

  it('returns the user represented by a valid access token', async () => {
    const user = {
      email: 'person@example.com',
      id: '4ac60f36-9f7a-419f-b447-d8f9d2bc7cd8',
      role: 'authenticated' as const,
    };
    const verifyAccessToken = vi.fn().mockResolvedValue(user);
    const { server } = startServer(verifyAccessToken);
    const response = await fetch(await getUrl(server, '/auth/me'), {
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.status).toBe(200);
    expect(verifyAccessToken).toHaveBeenCalledWith('valid-token');
    await expect(response.json()).resolves.toEqual({ user });
  });

  it('rejects an invalid access token', async () => {
    const verifyAccessToken = vi.fn().mockRejectedValue(new Error('invalid'));
    const { server } = startServer(verifyAccessToken);
    const response = await fetch(await getUrl(server, '/auth/me'), {
      headers: { authorization: 'Bearer invalid-token' },
    });

    expect(response.status).toBe(401);
  });
});
