import { createServer } from './app.js';
import { createSupabaseAuthService } from './auth/auth-service.js';
import { loadEnvironmentFile, parseEnvironment } from './config/env.js';
import { createBoardnestDataService } from './graphql/data-service.js';
import { createRedisEventBus } from './realtime/redis-event-bus.js';

loadEnvironmentFile();

const environment = parseEnvironment();
const authService = createSupabaseAuthService({
  callbackUrl: `${environment.API_URL}/auth/callback`,
  publishableKey: environment.SUPABASE_PUBLISHABLE_KEY,
  supabaseUrl: environment.SUPABASE_URL,
});
const events = await createRedisEventBus(environment.REDIS_URL);

const server = await createServer({
  authService,
  corsOrigin: environment.CORS_ORIGIN,
  createDataService: (accessToken) =>
    createBoardnestDataService(
      environment.SUPABASE_URL,
      environment.SUPABASE_PUBLISHABLE_KEY,
      accessToken,
    ),
  events,
  introspection: environment.NODE_ENV !== 'production',
  secureCookies: environment.NODE_ENV === 'production',
}).catch(async (error: unknown) => {
  await events.close();
  throw error;
});

server.listen(environment.PORT, () => {
  console.info(
    `Boardnest API listening on port ${environment.PORT} (HTTP + WebSocket /graphql)`,
  );
});

let shutdownPromise: Promise<void> | null = null;

function shutdown(signal: NodeJS.Signals): void {
  if (shutdownPromise) return;
  console.info(`${signal} received; closing API, WebSocket, and Redis clients`);
  shutdownPromise = server.shutdown().catch((error: unknown) => {
    console.error('API shutdown failed', error);
    process.exitCode = 1;
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
