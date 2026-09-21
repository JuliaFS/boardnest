import { createServer } from './app.js';
import { createSupabaseAuthService } from './auth/auth-service.js';
import { loadEnvironmentFile, parseEnvironment } from './config/env.js';

loadEnvironmentFile();

const environment = parseEnvironment();
const authService = createSupabaseAuthService({
  callbackUrl: `${environment.API_URL}/auth/callback`,
  publishableKey: environment.SUPABASE_PUBLISHABLE_KEY,
  supabaseUrl: environment.SUPABASE_URL,
});

const server = createServer({
  authService,
  corsOrigin: environment.CORS_ORIGIN,
  secureCookies: environment.NODE_ENV === 'production',
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
