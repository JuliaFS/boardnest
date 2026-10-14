import { createServer as createHttpServer, type Server } from 'node:http';

import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express5';
import { makeExecutableSchema } from '@graphql-tools/schema';
import cors from 'cors';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { useServer } from 'graphql-ws/use/ws';
import { WebSocketServer } from 'ws';
import { z } from 'zod';

import type { AuthService } from './auth/auth-service.js';
import {
  AccountDeletionError,
  type AccountDeletionService,
} from './auth/account-deletion-service.js';
import type { GuestAdmission } from './auth/guest-admission.js';
import type { MailTransport } from './email/smtp-transport.js';
import {
  clearSessionCookies,
  type CookieSameSite,
  PkceCookieStorage,
  readAuthCookies,
  setSessionCookies,
} from './auth/cookies.js';
import { resolveRequestSession } from './auth/session.js';
import type { BoardnestDataService } from './graphql/data-service.js';
import { type GraphQLContext, resolvers, typeDefs } from './graphql/schema.js';
import { createMaxDepthRule } from './graphql/security.js';
import type { InvitationEmailService } from './invitations/invitation-email.js';
import type { NotificationDeliveryWorker } from './notifications/notification-delivery-worker.js';
import {
  createInMemoryEventBus,
  type RealtimeEventBus,
} from './realtime/event-bus.js';
import type { ReminderScheduler } from './reminders/reminder-scheduler.js';

const credentialsSchema = z.object({
  captchaToken: z.string().min(1).max(2048),
  email: z.email(),
  password: z.string().min(1),
});
const guestSchema = z.object({
  captchaToken: z.string().min(1).max(2048),
});
const registrationSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(2).max(80),
  returnTo: z
    .string()
    .max(2048)
    .refine(isSafeReturnPath, 'Invalid return path.')
    .optional(),
});
const accountDeletionSchema = z.object({
  confirmation: z.literal('DELETE'),
  deleteWorkspaceIds: z
    .array(z.uuid())
    .max(100)
    .refine((ids) => new Set(ids).size === ids.length),
  transfers: z.record(z.uuid(), z.uuid()),
});

export interface ServerOptions {
  accountDeletionService?: AccountDeletionService;
  authService: AuthService;
  corsOrigin: string;
  createDataService: (accessToken: string) => BoardnestDataService;
  cookieSameSite?: CookieSameSite;
  events?: RealtimeEventBus;
  emailTransport?: Pick<MailTransport, 'close'>;
  guestAdmission: GuestAdmission;
  introspection?: boolean;
  invitationEmail?: InvitationEmailService;
  notificationDeliveryWorker?: NotificationDeliveryWorker;
  reminderScheduler?: ReminderScheduler;
  secureCookies: boolean;
  trustProxyHops?: number;
}

export interface BoardnestServer extends Server {
  shutdown: () => Promise<void>;
}

export async function createServer(
  options: ServerOptions,
): Promise<BoardnestServer> {
  const cookieSameSite = options.cookieSameSite ?? 'Lax';
  if (cookieSameSite === 'None' && !options.secureCookies) {
    throw new Error('SameSite=None cookies require secureCookies=true.');
  }
  const app = express();
  app.set('trust proxy', options.trustProxyHops ?? 0);
  const httpServer = createHttpServer(app);
  const events = options.events ?? createInMemoryEventBus();
  const schema = makeExecutableSchema({ resolvers, typeDefs });
  const websocketServer = new WebSocketServer({
    path: '/graphql',
    server: httpServer,
  });
  const websocketContexts = new WeakMap<object, GraphQLContext>();
  const websocketCleanup = useServer(
    {
      context: (context) =>
        websocketContexts.get(context.extra.request) ?? {
          data: null,
          events,
          user: null,
        },
      onConnect: async (context) => {
        if (context.extra.request.headers.origin !== options.corsOrigin) {
          return false;
        }

        const cookies = readAuthCookies(context.extra.request);
        if (!cookies.accessToken) return false;

        try {
          const user = await options.authService.verify(cookies.accessToken);
          websocketContexts.set(context.extra.request, {
            data: options.createDataService(cookies.accessToken),
            events,
            user,
          });
          return true;
        } catch {
          return false;
        }
      },
      schema,
    },
    websocketServer,
  );
  const apollo = new ApolloServer<GraphQLContext>({
    csrfPrevention: true,
    includeStacktraceInErrorResponses: false,
    introspection: options.introspection ?? false,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
      {
        serverWillStart() {
          return Promise.resolve({
            async drainServer() {
              await websocketCleanup.dispose();
              await Promise.all([
                events.close(),
                Promise.resolve(options.emailTransport?.close?.()),
                options.guestAdmission.close(),
                options.notificationDeliveryWorker?.close() ??
                  Promise.resolve(),
                options.reminderScheduler?.close() ?? Promise.resolve(),
              ]);
            },
          });
        },
      },
    ],
    schema,
    validationRules: [createMaxDepthRule(10)],
  });
  await apollo.start();

  app.disable('x-powered-by');
  app.use(
    cors({
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      origin: options.corsOrigin,
    }),
  );

  app.get('/health', (_request, response) => {
    response.json({ service: 'boardnest-api', status: 'ok' });
  });

  app.get('/auth/callback', async (request, response) => {
    const code = readQueryString(request.query.code);
    const flowId = readQueryString(request.query.sb_flow_id);
    const returnTo = safeReturnPath(readQueryString(request.query.returnTo));
    if (!code) {
      response.redirect(303, `${options.corsOrigin}/login?confirmation=failed`);
      return;
    }

    try {
      const storage = new PkceCookieStorage(
        request,
        response,
        options.secureCookies,
        cookieSameSite,
      );
      const result = await options.authService.completeConfirmation({
        code,
        ...(flowId ? { flowId } : {}),
        storage,
      });
      setSessionCookies(
        response,
        result.session,
        options.secureCookies,
        cookieSameSite,
      );
      response.redirect(303, `${options.corsOrigin}${returnTo}`);
    } catch {
      clearSessionCookies(response, options.secureCookies, cookieSameSite);
      response.redirect(303, `${options.corsOrigin}/login?confirmation=failed`);
    }
  });

  app.use('/auth', express.json({ limit: '16kb' }));
  app.post(
    '/auth/register',
    trustedOrigin(options.corsOrigin),
    async (request, response) => {
      try {
        const input = registrationSchema.parse(request.body);
        const storage = new PkceCookieStorage(
          request,
          response,
          options.secureCookies,
          cookieSameSite,
        );
        const registration = await options.authService.register({
          captchaToken: input.captchaToken,
          displayName: input.displayName,
          email: input.email,
          password: input.password,
          ...(input.returnTo ? { returnTo: input.returnTo } : {}),
          storage,
        });
        if (registration.result) {
          setSessionCookies(
            response,
            registration.result.session,
            options.secureCookies,
            cookieSameSite,
          );
        }
        response.status(201).json({
          confirmationRequired: registration.confirmationRequired,
          user: registration.result?.user ?? null,
        });
      } catch (error) {
        response.status(400).json({ error: authErrorMessage(error) });
      }
    },
  );

  app.post(
    '/auth/guest',
    trustedOrigin(options.corsOrigin),
    async (request, response) => {
      let captchaToken: string;
      try {
        captchaToken = guestSchema.parse(request.body).captchaToken;
      } catch {
        response.status(400).json({ error: 'Complete the security check.' });
        return;
      }

      let reservation: string;
      try {
        const clientIp =
          request.ip ?? request.socket.remoteAddress ?? 'unknown-client';
        const decision = await options.guestAdmission.consume(clientIp);
        if (!decision.allowed) {
          response.setHeader(
            'Retry-After',
            String(decision.retryAfterSeconds ?? 3600),
          );
          response.status(429).json({
            error:
              'Too many guest sessions were started. Please try again later.',
          });
          return;
        }
        reservation = decision.reservation;
      } catch {
        response.status(503).json({
          error: 'The guest demo is temporarily unavailable.',
        });
        return;
      }

      try {
        const result = await options.authService.anonymous(captchaToken);
        setSessionCookies(
          response,
          result.session,
          options.secureCookies,
          cookieSameSite,
        );
        response.status(201).json({ user: result.user });
      } catch (error) {
        await options.guestAdmission
          .release(reservation)
          .catch((releaseError) => {
            console.error(
              'Failed to release guest admission reservation',
              releaseError,
            );
          });
        response.status(429).json({ error: authErrorMessage(error) });
      }
    },
  );

  app.post(
    '/auth/login',
    trustedOrigin(options.corsOrigin),
    async (request, response) => {
      try {
        const input = credentialsSchema.parse(request.body);
        const result = await options.authService.login(
          input.email,
          input.password,
          input.captchaToken,
        );
        setSessionCookies(
          response,
          result.session,
          options.secureCookies,
          cookieSameSite,
        );
        response.json({ user: result.user });
      } catch (error) {
        response.status(401).json({ error: authErrorMessage(error) });
      }
    },
  );

  app.post(
    '/auth/logout',
    trustedOrigin(options.corsOrigin),
    async (request, response) => {
      const cookies = readAuthCookies(request);
      if (cookies.accessToken && cookies.refreshToken) {
        await options.authService
          .signOut(cookies.accessToken, cookies.refreshToken)
          .catch(() => undefined);
      }
      clearSessionCookies(response, options.secureCookies, cookieSameSite);
      response.status(204).end();
    },
  );

  app.get('/auth/account-deletion', async (request, response) => {
    if (!options.accountDeletionService) {
      response.status(503).json({ error: 'Account deletion is unavailable.' });
      return;
    }
    const session = await resolveRequestSession(
      request,
      response,
      options.authService,
      options.secureCookies,
      cookieSameSite,
    );
    if (!session) {
      response.status(401).json({ error: 'Authentication required' });
      return;
    }

    try {
      response.json({
        impact: await options.accountDeletionService.impact(session.user.id),
      });
    } catch (error) {
      response.status(accountDeletionStatus(error)).json({
        error: accountDeletionMessage(error),
      });
    }
  });

  app.post(
    '/auth/account-deletion',
    trustedOrigin(options.corsOrigin),
    async (request, response) => {
      if (!options.accountDeletionService) {
        response
          .status(503)
          .json({ error: 'Account deletion is unavailable.' });
        return;
      }
      const session = await resolveRequestSession(
        request,
        response,
        options.authService,
        options.secureCookies,
        cookieSameSite,
      );
      if (!session) {
        response.status(401).json({ error: 'Authentication required' });
        return;
      }

      try {
        const input = accountDeletionSchema.parse(request.body);
        await options.accountDeletionService.deleteAccount(session.user.id, {
          deleteWorkspaceIds: input.deleteWorkspaceIds,
          transfers: input.transfers,
        });
        clearSessionCookies(response, options.secureCookies, cookieSameSite);
        response.status(204).end();
      } catch (error) {
        response.status(accountDeletionStatus(error)).json({
          error: accountDeletionMessage(error),
        });
      }
    },
  );

  const sessionHandler = async (request: Request, response: Response) => {
    const session = await resolveRequestSession(
      request,
      response,
      options.authService,
      options.secureCookies,
      cookieSameSite,
    );
    if (!session) {
      response.status(401).json({ error: 'Authentication required' });
      return;
    }
    response.json({ user: session.user });
  };
  app.get('/auth/session', sessionHandler);
  app.get('/auth/me', sessionHandler);

  app.use(
    '/graphql',
    trustedOrigin(options.corsOrigin),
    express.json({ limit: '100kb' }),
    expressMiddleware(apollo, {
      context: async ({ req, res }): Promise<GraphQLContext> => {
        const session = await resolveRequestSession(
          req,
          res,
          options.authService,
          options.secureCookies,
          cookieSameSite,
        );
        return {
          data: session ? options.createDataService(session.accessToken) : null,
          events,
          ...(options.invitationEmail
            ? { invitationEmail: options.invitationEmail }
            : {}),
          user: session?.user ?? null,
        };
      },
    }),
  );

  app.use(
    (
      error: unknown,
      _request: Request,
      response: Response,
      next: NextFunction,
    ) => {
      void next;
      if (error instanceof SyntaxError) {
        response.status(400).json({ error: 'Invalid JSON request body.' });
        return;
      }
      response.status(500).json({ error: 'Internal server error' });
    },
  );
  app.use((_request, response) => {
    response.status(404).json({ error: 'Not found' });
  });

  return Object.assign(httpServer, {
    shutdown: () => apollo.stop(),
  });
}

function trustedOrigin(expectedOrigin: string) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (
      request.method === 'POST' &&
      request.headers.origin !== expectedOrigin
    ) {
      response.status(403).json({ error: 'Untrusted request origin' });
      return;
    }
    next();
  };
}

function readQueryString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function isSafeReturnPath(value: string): boolean {
  return value.startsWith('/') && !value.startsWith('//');
}

function safeReturnPath(value: string | null): string {
  return value && isSafeReturnPath(value) ? value : '/dashboard';
}

function authErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return 'Invalid request data.';
  if (error instanceof Error) return error.message;
  return 'Authentication failed.';
}

function accountDeletionMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return 'Confirm account deletion and resolve every owned workspace.';
  }
  if (error instanceof AccountDeletionError) return error.message;
  return 'Account deletion failed. Please try again.';
}

function accountDeletionStatus(error: unknown): number {
  if (error instanceof z.ZodError) return 400;
  if (error instanceof AccountDeletionError) return error.status;
  return 500;
}
