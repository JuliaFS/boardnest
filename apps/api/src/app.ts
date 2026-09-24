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
import {
  createInMemoryEventBus,
  type RealtimeEventBus,
} from './realtime/event-bus.js';

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});
const registrationSchema = credentialsSchema.extend({
  displayName: z.string().trim().min(2).max(80),
});

export interface ServerOptions {
  authService: AuthService;
  corsOrigin: string;
  createDataService: (accessToken: string) => BoardnestDataService;
  cookieSameSite?: CookieSameSite;
  events?: RealtimeEventBus;
  introspection?: boolean;
  secureCookies: boolean;
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
              await events.close();
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
      response.redirect(303, `${options.corsOrigin}/dashboard`);
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
          ...input,
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
    '/auth/login',
    trustedOrigin(options.corsOrigin),
    async (request, response) => {
      try {
        const input = credentialsSchema.parse(request.body);
        const result = await options.authService.login(
          input.email,
          input.password,
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

function authErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) return 'Invalid request data.';
  if (error instanceof Error) return error.message;
  return 'Authentication failed.';
}
