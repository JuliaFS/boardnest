import { createServer as createHttpServer, type Server } from 'node:http';

const healthResponse = JSON.stringify({
  service: 'boardnest-api',
  status: 'ok',
});

export function createServer(): Server {
  return createHttpServer((request, response) => {
    if (request.method === 'GET' && request.url === '/health') {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(healthResponse);
      return;
    }

    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: 'Not found' }));
  });
}
