import { createServer } from './app.js';
import { createSupabaseAccessTokenVerifier } from './auth/access-token.js';
import { loadEnvironmentFile, parseEnvironment } from './config/env.js';

loadEnvironmentFile();

const environment = parseEnvironment();
const verifyAccessToken = createSupabaseAccessTokenVerifier(
  environment.SUPABASE_URL,
  environment.SUPABASE_PUBLISHABLE_KEY,
);

const server = createServer({
  corsOrigin: environment.CORS_ORIGIN,
  verifyAccessToken,
});

server.listen(environment.PORT, () => {
  console.info(`Boardnest API listening on port ${environment.PORT}`);
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
