import { createServer } from './app.js';

const parsedPort = Number.parseInt(process.env.PORT ?? '4000', 10);

if (
  !Number.isSafeInteger(parsedPort) ||
  parsedPort < 1 ||
  parsedPort > 65_535
) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const server = createServer();

server.listen(parsedPort, () => {
  console.info(`Boardnest API listening on port ${parsedPort}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.info(`${signal} received; closing HTTP server`);

  server.close((error) => {
    if (error) {
      console.error('HTTP server shutdown failed', error);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
