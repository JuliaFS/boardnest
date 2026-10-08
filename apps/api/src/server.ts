import { createServer } from './app.js';
import { createSupabaseAuthService } from './auth/auth-service.js';
import { createSupabaseAccountDeletionService } from './auth/account-deletion-service.js';
import { createRedisGuestAdmission } from './auth/guest-admission.js';
import { loadEnvironmentFile, parseEnvironment } from './config/env.js';
import { createBoardnestDataService } from './graphql/data-service.js';
import { createResendInvitationEmailService } from './invitations/invitation-email.js';
import { createRedisEventBus } from './realtime/redis-event-bus.js';
import {
  createSupabaseReminderScheduler,
  type ReminderScheduler,
} from './reminders/reminder-scheduler.js';

loadEnvironmentFile();

const environment = parseEnvironment();
const invitationEmail =
  environment.RESEND_API_KEY && environment.INVITATION_EMAIL_FROM
    ? createResendInvitationEmailService({
        apiKey: environment.RESEND_API_KEY,
        from: environment.INVITATION_EMAIL_FROM,
        webUrl: environment.CORS_ORIGIN,
      })
    : undefined;
const authService = createSupabaseAuthService({
  callbackUrl: `${environment.API_URL}/auth/callback`,
  publishableKey: environment.SUPABASE_PUBLISHABLE_KEY,
  supabaseUrl: environment.SUPABASE_URL,
});
const events = await createRedisEventBus(environment.REDIS_URL);
const guestAdmission = await createRedisGuestAdmission(
  environment.REDIS_URL,
  environment.GUEST_RATE_LIMIT_SECRET,
).catch(async (error: unknown) => {
  await events.close();
  throw error;
});
let reminderScheduler: ReminderScheduler | undefined;
const accountDeletionService = environment.SUPABASE_SERVICE_ROLE_KEY
  ? createSupabaseAccountDeletionService({
      serviceRoleKey: environment.SUPABASE_SERVICE_ROLE_KEY,
      supabaseUrl: environment.SUPABASE_URL,
    })
  : undefined;
if (environment.REMINDER_SCHEDULER_ENABLED) {
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required when the reminder scheduler is enabled.',
    );
  }
  reminderScheduler = createSupabaseReminderScheduler({
    batchSize: environment.REMINDER_SCHEDULER_BATCH_SIZE,
    intervalMs: environment.REMINDER_SCHEDULER_INTERVAL_MS,
    serviceRoleKey,
    supabaseUrl: environment.SUPABASE_URL,
  });
}

const server = await createServer({
  ...(accountDeletionService ? { accountDeletionService } : {}),
  authService,
  corsOrigin: environment.CORS_ORIGIN,
  createDataService: (accessToken) =>
    createBoardnestDataService(
      environment.SUPABASE_URL,
      environment.SUPABASE_PUBLISHABLE_KEY,
      accessToken,
    ),
  events,
  guestAdmission,
  introspection: environment.NODE_ENV !== 'production',
  ...(invitationEmail ? { invitationEmail } : {}),
  ...(reminderScheduler ? { reminderScheduler } : {}),
  cookieSameSite: environment.COOKIE_SAME_SITE === 'none' ? 'None' : 'Lax',
  secureCookies: environment.NODE_ENV === 'production',
  trustProxyHops: environment.TRUST_PROXY_HOPS,
}).catch(async (error: unknown) => {
  await Promise.allSettled([events.close(), guestAdmission.close()]);
  throw error;
});

server.listen(environment.PORT, () => {
  reminderScheduler?.start();
  console.info(
    `Boardnest API listening on port ${environment.PORT} (HTTP + WebSocket /graphql)`,
  );
});

let shutdownPromise: Promise<void> | null = null;

function shutdown(signal: NodeJS.Signals): void {
  if (shutdownPromise) return;
  console.info(
    `${signal} received; closing API, WebSocket, scheduler, and Redis clients`,
  );
  shutdownPromise = server.shutdown().catch((error: unknown) => {
    console.error('API shutdown failed', error);
    process.exitCode = 1;
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
