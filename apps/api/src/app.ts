import {
  createServer as createHttpServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';

import {
  readBearerToken,
  type VerifyAccessToken,
} from './auth/access-token.js';

const healthResponse = JSON.stringify({
  service: 'boardnest-api',
  status: 'ok',
});

interface ServerOptions {
  corsOrigin: string;
  verifyAccessToken: VerifyAccessToken;
}

function writeJson(
  response: ServerResponse,
  status: number,
  body: unknown,
): void {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

export function createServer({
  corsOrigin,
  verifyAccessToken,
}: ServerOptions): Server {
  return createHttpServer((request, response) => {
    void handleRequest(request, response, corsOrigin, verifyAccessToken);
  });
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  corsOrigin: string,
  verifyAccessToken: VerifyAccessToken,
): Promise<void> {
  response.setHeader('access-control-allow-origin', corsOrigin);
  response.setHeader('vary', 'origin');

  if (request.method === 'OPTIONS') {
    response.setHeader(
      'access-control-allow-headers',
      'authorization, content-type',
    );
    response.setHeader('access-control-allow-methods', 'GET, OPTIONS');
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(healthResponse);
    return;
  }

  if (request.method === 'GET' && request.url === '/auth/me') {
    const token = readBearerToken(request.headers.authorization);

    if (!token) {
      writeJson(response, 401, { error: 'Authentication required' });
      return;
    }

    try {
      const user = await verifyAccessToken(token);
      writeJson(response, 200, { user });
    } catch {
      writeJson(response, 401, { error: 'Invalid or expired access token' });
    }

    return;
  }

  writeJson(response, 404, { error: 'Not found' });
}
