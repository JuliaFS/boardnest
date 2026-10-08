import { once } from 'node:events';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import type { Session } from '@supabase/supabase-js';
import { createClient } from 'graphql-ws';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebSocket } from 'ws';

import { createServer } from './app.js';
import type { AccountDeletionService } from './auth/account-deletion-service.js';
import type { AuthService, PublicAuthUser } from './auth/auth-service.js';
import type { GuestAdmission } from './auth/guest-admission.js';
import type { BoardnestDataService } from './graphql/data-service.js';
import {
  createInMemoryEventBus,
  type RealtimeEventBus,
} from './realtime/event-bus.js';

const origin = 'http://localhost:5174';
const user: PublicAuthUser = {
  displayName: 'Test User',
  email: 'person@example.com',
  id: '4ac60f36-9f7a-419f-b447-d8f9d2bc7cd8',
  isAnonymous: false,
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

const servers = new Set<Server>();

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

function createGuestAdmission(): GuestAdmission {
  return {
    close: vi.fn().mockResolvedValue(undefined),
    consume: vi.fn().mockResolvedValue({
      allowed: true,
      reservation: 'boardnest:v1:guest:global:day:1',
    }),
    release: vi.fn().mockResolvedValue(undefined),
  };
}

function createAuthService(): AuthService {
  return {
    anonymous: vi.fn().mockResolvedValue({
      session,
      user: { ...user, displayName: 'Guest', email: null, isAnonymous: true },
    }),
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

function createAccountDeletionService(): AccountDeletionService {
  return {
    deleteAccount: vi.fn().mockResolvedValue(undefined),
    impact: vi.fn().mockResolvedValue({
      ownedWorkspaces: [],
      userId: user.id,
    }),
  };
}

async function startServer(
  authService = createAuthService(),
  dataService = {} as unknown as BoardnestDataService,
  events?: RealtimeEventBus,
  accountDeletionService?: AccountDeletionService,
) {
  const server = await createServer({
    ...(accountDeletionService ? { accountDeletionService } : {}),
    authService,
    corsOrigin: origin,
    createDataService: vi.fn(() => dataService),
    guestAdmission: createGuestAdmission(),
    ...(events ? { events } : {}),
    introspection: true,
    secureCookies: false,
  });
  servers.add(server);
  server.listen(0, '127.0.0.1');
  return { authService, server };
}

async function getUrl(server: Server, path: string) {
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  return `http://127.0.0.1:${address.port}${path}`;
}

describe('API server', () => {
  it('reports service health', async () => {
    const { server } = await startServer();
    const response = await fetch(await getUrl(server, '/health'));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      service: 'boardnest-api',
      status: 'ok',
    });
  });

  it('sets HttpOnly cookies without returning tokens on login', async () => {
    const { authService, server } = await startServer();
    const response = await fetch(await getUrl(server, '/auth/login'), {
      body: JSON.stringify({
        captchaToken: 'turnstile-token',
        email: 'person@example.com',
        password: 'StrongPass1',
      }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    });
    const body = (await response.json()) as Record<string, unknown>;
    const cookies = response.headers.getSetCookie();

    expect(response.status).toBe(200);
    expect(authService.login).toHaveBeenCalledWith(
      'person@example.com',
      'StrongPass1',
      'turnstile-token',
    );
    expect(body).toEqual({ user });
    expect(JSON.stringify(body)).not.toContain('access-token');
    expect(cookies).toHaveLength(2);
    expect(cookies.every((cookie) => cookie.includes('HttpOnly'))).toBe(true);
    expect(cookies.every((cookie) => cookie.includes('SameSite=Lax'))).toBe(
      true,
    );
  });

  it('forwards the CAPTCHA token during registration', async () => {
    const { authService, server } = await startServer();
    const response = await fetch(await getUrl(server, '/auth/register'), {
      body: JSON.stringify({
        captchaToken: 'registration-token',
        displayName: 'Test User',
        email: 'person@example.com',
        password: 'StrongPass1',
        returnTo: `/invite/${'a'.repeat(43)}`,
      }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    });

    expect(response.status).toBe(201);
    expect(authService.register).toHaveBeenCalledWith(
      expect.objectContaining({
        captchaToken: 'registration-token',
        displayName: 'Test User',
        email: 'person@example.com',
        password: 'StrongPass1',
        returnTo: `/invite/${'a'.repeat(43)}`,
      }),
    );
  });

  it('starts a guest session without returning tokens', async () => {
    const { authService, server } = await startServer();
    const response = await fetch(await getUrl(server, '/auth/guest'), {
      body: JSON.stringify({ captchaToken: 'turnstile-token' }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    });
    const body = (await response.json()) as { user: PublicAuthUser };

    expect(response.status).toBe(201);
    expect(authService.anonymous).toHaveBeenCalledWith('turnstile-token');
    expect(body.user).toMatchObject({
      displayName: 'Guest',
      email: null,
      isAnonymous: true,
    });
    expect(JSON.stringify(body)).not.toContain('access-token');
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });

  it('sets secure cross-site cookies when explicitly configured', async () => {
    const server = await createServer({
      authService: createAuthService(),
      cookieSameSite: 'None',
      corsOrigin: origin,
      createDataService: vi.fn(() => ({}) as BoardnestDataService),
      guestAdmission: createGuestAdmission(),
      introspection: true,
      secureCookies: true,
    });
    servers.add(server);
    server.listen(0, '127.0.0.1');

    const response = await fetch(await getUrl(server, '/auth/login'), {
      body: JSON.stringify({
        captchaToken: 'turnstile-token',
        email: 'person@example.com',
        password: 'StrongPass1',
      }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    });
    const cookies = response.headers.getSetCookie();

    expect(cookies).toHaveLength(2);
    expect(
      cookies.every(
        (cookie) =>
          cookie.includes('SameSite=None') && cookie.includes('Secure'),
      ),
    ).toBe(true);
  });

  it('rejects cross-origin auth mutations', async () => {
    const { authService, server } = await startServer();
    const response = await fetch(await getUrl(server, '/auth/login'), {
      body: JSON.stringify({
        captchaToken: 'turnstile-token',
        email: 'person@example.com',
        password: 'secret',
      }),
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
    const { authService, server } = await startServer();
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
    const { server } = await startServer(authService);
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
    const { authService, server } = await startServer();
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

  it('restores a safe invitation path after email confirmation', async () => {
    const { server } = await startServer();
    const returnTo = `/invite/${'a'.repeat(43)}`;
    const response = await fetch(
      await getUrl(
        server,
        `/auth/callback?code=one-time-code&returnTo=${encodeURIComponent(returnTo)}`,
      ),
      { redirect: 'manual' },
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${origin}${returnTo}`);
  });

  it('does not redirect outside the web application after confirmation', async () => {
    const { server } = await startServer();
    const response = await fetch(
      await getUrl(
        server,
        '/auth/callback?code=one-time-code&returnTo=https%3A%2F%2Fattacker.example',
      ),
      { redirect: 'manual' },
    );

    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(`${origin}/dashboard`);
  });

  it('clears both cookies on logout', async () => {
    const { authService, server } = await startServer();
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

  it('returns the authenticated account-deletion impact', async () => {
    const accountDeletionService = createAccountDeletionService();
    const { server } = await startServer(
      createAuthService(),
      {} as BoardnestDataService,
      undefined,
      accountDeletionService,
    );
    const response = await fetch(
      await getUrl(server, '/auth/account-deletion'),
      { headers: { cookie: 'boardnest-access=access-token' } },
    );

    expect(response.status).toBe(200);
    expect(accountDeletionService.impact).toHaveBeenCalledWith(user.id);
    await expect(response.json()).resolves.toEqual({
      impact: { ownedWorkspaces: [], userId: user.id },
    });
  });

  it('deletes only the authenticated account and clears its cookies', async () => {
    const accountDeletionService = createAccountDeletionService();
    const { server } = await startServer(
      createAuthService(),
      {} as BoardnestDataService,
      undefined,
      accountDeletionService,
    );
    const input = {
      confirmation: 'DELETE',
      deleteWorkspaceIds: ['10000000-0000-4000-8000-000000000001'],
      transfers: {},
    };
    const response = await fetch(
      await getUrl(server, '/auth/account-deletion'),
      {
        body: JSON.stringify(input),
        headers: {
          'content-type': 'application/json',
          cookie: 'boardnest-access=access-token',
          origin,
        },
        method: 'POST',
      },
    );

    expect(response.status).toBe(204);
    expect(accountDeletionService.deleteAccount).toHaveBeenCalledWith(user.id, {
      deleteWorkspaceIds: input.deleteWorkspaceIds,
      transfers: {},
    });
    expect(
      response.headers
        .getSetCookie()
        .every((cookie) => cookie.includes('Max-Age=0')),
    ).toBe(true);
  });

  it('exposes the authenticated user through GraphQL without exposing tokens', async () => {
    const { server } = await startServer();
    const response = await fetch(await getUrl(server, '/graphql'), {
      body: JSON.stringify({
        query:
          'query CurrentUser { currentUser { id email displayName isAnonymous role } }',
      }),
      headers: {
        'content-type': 'application/json',
        cookie: 'boardnest-access=access-token',
        origin,
      },
      method: 'POST',
    });
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toEqual({ data: { currentUser: user } });
    expect(JSON.stringify(body)).not.toContain('access-token');
  });

  it('rejects protected GraphQL fields without a session', async () => {
    const { server } = await startServer();
    const response = await fetch(await getUrl(server, '/graphql'), {
      body: JSON.stringify({ query: '{ workspaces { nodes { id } } }' }),
      headers: { 'content-type': 'application/json', origin },
      method: 'POST',
    });
    const body = (await response.json()) as {
      errors: Array<{ extensions: { code: string } }>;
    };

    expect(response.status).toBe(200);
    expect(body.errors[0]?.extensions.code).toBe('UNAUTHENTICATED');
  });

  it('delegates a validated createProject mutation to the RLS data service', async () => {
    const project = {
      archived_at: null,
      created_at: new Date(0).toISOString(),
      created_by: user.id,
      description: null,
      due_date: null,
      id: 'f2410cb7-47f6-4af6-8ed9-f1d7a45158fc',
      name: 'Launch',
      start_date: null,
      status: 'active',
      updated_at: new Date(0).toISOString(),
      visibility: 'private',
      workspace_id: '6992c303-a240-4e15-8fcc-461d53756324',
    };
    const createProject = vi.fn().mockResolvedValue(project);
    const dataService = {
      createProject,
    } as unknown as BoardnestDataService;
    const { server } = await startServer(createAuthService(), dataService);
    const response = await fetch(await getUrl(server, '/graphql'), {
      body: JSON.stringify({
        query: `mutation CreateProject($input: CreateProjectInput!) {
          createProject(input: $input) { id name visibility status }
        }`,
        variables: {
          input: {
            name: 'Launch',
            visibility: 'PRIVATE',
            workspaceId: project.workspace_id,
          },
        },
      }),
      headers: {
        'content-type': 'application/json',
        cookie: 'boardnest-access=access-token',
        origin,
      },
      method: 'POST',
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      data: {
        createProject: {
          id: project.id,
          name: 'Launch',
          status: 'ACTIVE',
          visibility: 'PRIVATE',
        },
      },
    });
    expect(createProject).toHaveBeenCalledWith(
      {
        name: 'Launch',
        status: 'active',
        visibility: 'private',
        workspace_id: project.workspace_id,
      },
      user.id,
    );
  });

  it('delivers authenticated task subscription events over WebSocket', async () => {
    const projectId = '6992c303-a240-4e15-8fcc-461d53756324';
    const task = {
      archived_at: null,
      created_at: new Date(0).toISOString(),
      created_by: user.id,
      description: null,
      due_at: null,
      id: 'f2410cb7-47f6-4af6-8ed9-f1d7a45158fc',
      position: 1000,
      priority: 'medium',
      project_id: projectId,
      status_id: 'ae248328-e9e4-4416-a92d-47af95406e4d',
      title: 'Ship real-time updates',
      updated_at: new Date(0).toISOString(),
    };
    const dataService = {
      createTask: vi.fn().mockResolvedValue(task),
      project: vi.fn().mockResolvedValue({ id: projectId }),
    } as unknown as BoardnestDataService;
    const events = createInMemoryEventBus();
    const subscribe = vi.spyOn(events, 'subscribeToTasks');
    const { server } = await startServer(
      createAuthService(),
      dataService,
      events,
    );
    const httpUrl = await getUrl(server, '/graphql');
    const wsUrl = httpUrl.replace('http:', 'ws:');

    class AuthenticatedWebSocket extends WebSocket {
      constructor(address: string | URL, protocols?: string | string[]) {
        super(address, protocols, {
          headers: {
            cookie: 'boardnest-access=access-token',
            origin,
          },
        });
      }
    }

    const client = createClient({
      url: wsUrl,
      webSocketImpl: AuthenticatedWebSocket,
    });
    const result = new Promise<unknown>((resolve, reject) => {
      const unsubscribe = client.subscribe(
        {
          query: `subscription TaskCreated($projectId: ID!) {
            taskCreated(projectId: $projectId) { id title priority }
          }`,
          variables: { projectId },
        },
        {
          complete: () => undefined,
          error: reject,
          next: (value) => {
            unsubscribe();
            resolve(value);
          },
        },
      );
    });

    await vi.waitFor(() => expect(subscribe).toHaveBeenCalledOnce());
    const mutation = await fetch(httpUrl, {
      body: JSON.stringify({
        query: `mutation CreateTask($input: CreateTaskInput!) {
          createTask(input: $input) { id }
        }`,
        variables: {
          input: {
            projectId,
            statusId: task.status_id,
            title: task.title,
          },
        },
      }),
      headers: {
        'content-type': 'application/json',
        cookie: 'boardnest-access=access-token',
        origin,
      },
      method: 'POST',
    });

    expect(mutation.status).toBe(200);
    await expect(result).resolves.toEqual({
      data: {
        taskCreated: {
          id: task.id,
          priority: 'MEDIUM',
          title: task.title,
        },
      },
    });
    expect(dataService.project).toHaveBeenCalledTimes(2);
    await client.dispose();
  });
});
