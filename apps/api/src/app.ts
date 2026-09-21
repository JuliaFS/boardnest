import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';

import { z } from 'zod';

import type { AuthService, PublicAuthUser } from './auth/auth-service.js';
import {
  clearSessionCookies,
  PkceCookieStorage,
  readAuthCookies,
  setSessionCookies,
} from './auth/cookies.js';

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
const registrationSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(2).max(80),
});
const healthResponse = JSON.stringify({
  service: 'boardnest-api',
  status: 'ok',
});

interface ServerOptions {
  authService: AuthService;
  corsOrigin: string;
  secureCookies: boolean;
}

export function createServer(options: ServerOptions): Server {
  return createHttpServer((request, response) => {
    void handleRequest(request, response, options).catch(() => {
      if (!response.headersSent) {
        writeJson(response, 500, { error: 'Internal server error' });
      } else if (!response.writableEnded) {
        response.end();
      }
    });
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: ServerOptions,
): Promise<void> {
  setCorsHeaders(response, options.corsOrigin);
  const url = new URL(request.url ?? '/', 'http://localhost');

  if (request.method === 'OPTIONS') {
    response.setHeader('access-control-allow-headers', 'content-type');
    response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(healthResponse);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/auth/callback') {
    await handleConfirmationCallback(request, response, url, options);
    return;
  }

  if (request.method === 'POST' && url.pathname.startsWith('/auth/')) {
    if (request.headers.origin !== options.corsOrigin) {
      writeJson(response, 403, { error: 'Untrusted request origin' });
      return;
    }
  }

  if (request.method === 'POST' && url.pathname === '/auth/register') {
    try {
      const input = registrationSchema.parse(await readJsonBody(request));
      const storage = new PkceCookieStorage(
        request,
        response,
        options.secureCookies,
      );
      const registration = await options.authService.register({
        ...input,
        storage,
      });

      if (registration.result) {
        setSessionCookies(
          response,
          registration.result.session,
          options.secureCookies,
        );
      }

      writeJson(response, 201, {
        confirmationRequired: registration.confirmationRequired,
        user: registration.result?.user ?? null,
      });
    } catch (error) {
      writeJson(response, 400, { error: authErrorMessage(error) });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/auth/login') {
    try {
      const input = credentialsSchema.parse(await readJsonBody(request));
      const result = await options.authService.login(
        input.email,
        input.password,
      );
      setSessionCookies(response, result.session, options.secureCookies);
      writeJson(response, 200, { user: result.user });
    } catch (error) {
      writeJson(response, 401, { error: authErrorMessage(error) });
    }
    return;
  }

  if (request.method === 'POST' && url.pathname === '/auth/logout') {
    const cookies = readAuthCookies(request);
    if (cookies.accessToken && cookies.refreshToken) {
      await options.authService
        .signOut(cookies.accessToken, cookies.refreshToken)
        .catch(() => undefined);
    }
    clearSessionCookies(response, options.secureCookies);
    response.writeHead(204);
    response.end();
    return;
  }

  if (
    request.method === 'GET' &&
    (url.pathname === '/auth/session' || url.pathname === '/auth/me')
  ) {
    const user = await resolveUserSession(request, response, options);
    if (!user) {
      writeJson(response, 401, { error: 'Authentication required' });
      return;
    }
    writeJson(response, 200, { user });
    return;
  }

  writeJson(response, 404, { error: 'Not found' });
}

async function handleConfirmationCallback(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  options: ServerOptions,
): Promise<void> {
  const code = url.searchParams.get('code');
  const flowId = url.searchParams.get('sb_flow_id');

  if (!code) {
    redirect(response, `${options.corsOrigin}/login?confirmation=failed`);
    return;
  }

  try {
    const storage = new PkceCookieStorage(
      request,
      response,
      options.secureCookies,
    );
    const result = await options.authService.completeConfirmation({
      code,
      ...(flowId ? { flowId } : {}),
      storage,
    });
    setSessionCookies(response, result.session, options.secureCookies);
    redirect(response, `${options.corsOrigin}/dashboard`);
  } catch {
    clearSessionCookies(response, options.secureCookies);
    redirect(response, `${options.corsOrigin}/login?confirmation=failed`);
  }
}

async function resolveUserSession(
  request: IncomingMessage,
  response: ServerResponse,
  options: ServerOptions,
): Promise<PublicAuthUser | null> {
  const cookies = readAuthCookies(request);

  if (cookies.accessToken) {
    try {
      return await options.authService.verify(cookies.accessToken);
    } catch {
      // An expired token may still be recovered with the refresh cookie.
    }
  }

  if (cookies.refreshToken) {
    try {
      const result = await options.authService.refresh(cookies.refreshToken);
      setSessionCookies(response, result.session, options.secureCookies);
      return result.user;
    } catch {
      // Clear an invalid session below.
    }
  }

  clearSessionCookies(response, options.secureCookies);
  return null;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request as AsyncIterable<unknown>) {
    const buffer =
      typeof chunk === 'string'
        ? Buffer.from(chunk)
        : chunk instanceof Uint8Array
          ? Buffer.from(chunk)
          : null;
    if (!buffer) throw new Error('Invalid request body.');
    size += buffer.length;
    if (size > 16_384) throw new Error('Request body is too large.');
    chunks.push(buffer);
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

function setCorsHeaders(response: ServerResponse, corsOrigin: string): void {
  response.setHeader('access-control-allow-credentials', 'true');
  response.setHeader('access-control-allow-origin', corsOrigin);
  response.setHeader('vary', 'Origin');
}

function writeJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.setHeader('cache-control', 'private, no-store');
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

function redirect(response: ServerResponse, location: string): void {
  response.setHeader('cache-control', 'private, no-store');
  response.writeHead(303, { location });
  response.end();
}

function authErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return 'Invalid request data.';
  if (error instanceof Error) return error.message;
  return 'Authentication failed.';
}
