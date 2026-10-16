import { createServer } from './app.js';
import { createSupabaseAuthService } from './auth/auth-service.js';
import { createSupabaseAccountDeletionService } from './auth/account-deletion-service.js';
import { createRedisGuestAdmission } from './auth/guest-admission.js';
import { loadEnvironmentFile, parseEnvironment } from './config/env.js';
import { createSmtpTransport } from './email/smtp-transport.js';
import { createBoardnestDataService } from './graphql/data-service.js';
import {
  createResendInvitationEmailService,
  createSmtpInvitationEmailService,
} from './invitations/invitation-email.js';
import {
  createSupabaseCustomNotificationScheduler,
  type CustomNotificationScheduler,
} from './notifications/custom-notification-scheduler.js';
import {
  createSupabaseNotificationDeliveryWorker,
  type NotificationDeliveryWorker,
} from './notifications/notification-delivery-worker.js';
import { createRedisEventBus } from './realtime/redis-event-bus.js';
import {
  createSupabaseReminderScheduler,
  type ReminderScheduler,
} from './reminders/reminder-scheduler.js';

loadEnvironmentFile();

const environment = parseEnvironment();
const emailProvider =
  environment.EMAIL_PROVIDER ??
  (environment.RESEND_API_KEY ? 'resend' : undefined);
const smtpConfiguration =
  emailProvider === 'smtp' &&
  environment.SMTP_HOST &&
  environment.SMTP_PASSWORD &&
  environment.SMTP_PORT !== undefined &&
  environment.SMTP_SECURE !== undefined &&
  environment.SMTP_USER
    ? {
        host: environment.SMTP_HOST,
        password: environment.SMTP_PASSWORD,
        port: environment.SMTP_PORT,
        secure: environment.SMTP_SECURE,
        user: environment.SMTP_USER,
      }
    : undefined;
const smtpTransport = smtpConfiguration
  ? createSmtpTransport(smtpConfiguration)
  : undefined;
const invitationEmail =
  emailProvider === 'resend' &&
  environment.RESEND_API_KEY &&
  environment.INVITATION_EMAIL_FROM
    ? createResendInvitationEmailService({
        apiKey: environment.RESEND_API_KEY,
        from: environment.INVITATION_EMAIL_FROM,
        webUrl: environment.CORS_ORIGIN,
      })
    : emailProvider === 'smtp' &&
        environment.INVITATION_EMAIL_FROM &&
        smtpConfiguration &&
        smtpTransport
      ? createSmtpInvitationEmailService({
          ...smtpConfiguration,
          from: environment.INVITATION_EMAIL_FROM,
          transport: smtpTransport,
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
let customNotificationScheduler: CustomNotificationScheduler | undefined;
let notificationDeliveryWorker: NotificationDeliveryWorker | undefined;
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
if (environment.CUSTOM_NOTIFICATION_SCHEDULER_ENABLED) {
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is required when the custom notification scheduler is enabled.',
    );
  }
  customNotificationScheduler = createSupabaseCustomNotificationScheduler({
    batchSize: environment.CUSTOM_NOTIFICATION_SCHEDULER_BATCH_SIZE,
    intervalMs: environment.CUSTOM_NOTIFICATION_SCHEDULER_INTERVAL_MS,
    serviceRoleKey,
    supabaseUrl: environment.SUPABASE_URL,
  });
}
if (environment.EMAIL_DELIVERY_WORKER_ENABLED) {
  const serviceRoleKey = environment.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey || !smtpTransport || !environment.INVITATION_EMAIL_FROM) {
    throw new Error(
      'Service-role, SMTP, and sender configuration is required when the email delivery worker is enabled.',
    );
  }
  notificationDeliveryWorker = createSupabaseNotificationDeliveryWorker({
    batchSize: environment.EMAIL_DELIVERY_WORKER_BATCH_SIZE,
    from: environment.INVITATION_EMAIL_FROM,
    intervalMs: environment.EMAIL_DELIVERY_WORKER_INTERVAL_MS,
    serviceRoleKey,
    supabaseUrl: environment.SUPABASE_URL,
    transport: smtpTransport,
  });
}

const server = await createServer({
  ...(accountDeletionService ? { accountDeletionService } : {}),
  authService,
  corsOrigin: environment.CORS_ORIGIN,
  ...(customNotificationScheduler ? { customNotificationScheduler } : {}),
  createDataService: (accessToken) =>
    createBoardnestDataService(
      environment.SUPABASE_URL,
      environment.SUPABASE_PUBLISHABLE_KEY,
      accessToken,
    ),
  events,
  ...(smtpTransport ? { emailTransport: smtpTransport } : {}),
  guestAdmission,
  introspection: environment.NODE_ENV !== 'production',
  ...(invitationEmail ? { invitationEmail } : {}),
  ...(notificationDeliveryWorker ? { notificationDeliveryWorker } : {}),
  ...(reminderScheduler ? { reminderScheduler } : {}),
  cookieSameSite: environment.COOKIE_SAME_SITE === 'none' ? 'None' : 'Lax',
  secureCookies: environment.NODE_ENV === 'production',
  trustProxyHops: environment.TRUST_PROXY_HOPS,
}).catch(async (error: unknown) => {
  await Promise.allSettled([
    events.close(),
    customNotificationScheduler?.close(),
    guestAdmission.close(),
    reminderScheduler?.close(),
    notificationDeliveryWorker?.close(),
    Promise.resolve(smtpTransport?.close?.()),
  ]);
  throw error;
});

server.listen(environment.PORT, () => {
  customNotificationScheduler?.start();
  reminderScheduler?.start();
  notificationDeliveryWorker?.start();
  console.info(
    `Boardnest API listening on port ${environment.PORT} (HTTP + WebSocket /graphql)`,
  );
});

let shutdownPromise: Promise<void> | null = null;

function shutdown(signal: NodeJS.Signals): void {
  if (shutdownPromise) return;
  console.info(
    `${signal} received; closing API, WebSocket, background workers, and Redis clients`,
  );
  shutdownPromise = server.shutdown().catch((error: unknown) => {
    console.error('API shutdown failed', error);
    process.exitCode = 1;
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
