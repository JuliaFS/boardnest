import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AuthService, PublicAuthUser } from './auth-service.js';
import {
  clearSessionCookies,
  type CookieSameSite,
  readAuthCookies,
  setSessionCookies,
} from './cookies.js';

export interface RequestSession {
  accessToken: string;
  user: PublicAuthUser;
}

export function parseBearerAuthorization(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const match = /^Bearer\s+(\S+)$/i.exec(value.trim());
  return match?.[1] ?? null;
}

export function readBearerAccessToken(request: IncomingMessage): string | null {
  return parseBearerAuthorization(request.headers.authorization);
}

export async function resolveRequestSession(
  request: IncomingMessage,
  response: ServerResponse,
  authService: AuthService,
  secureCookies: boolean,
  cookieSameSite: CookieSameSite = 'Lax',
): Promise<RequestSession | null> {
  const bearerAccessToken = readBearerAccessToken(request);
  if (bearerAccessToken) {
    try {
      return {
        accessToken: bearerAccessToken,
        user: await authService.verify(bearerAccessToken),
      };
    } catch {
      return null;
    }
  }

  const cookies = readAuthCookies(request);

  if (cookies.accessToken) {
    try {
      return {
        accessToken: cookies.accessToken,
        user: await authService.verify(cookies.accessToken),
      };
    } catch {
      // An expired access token may still be recovered with the refresh cookie.
    }
  }

  if (cookies.refreshToken) {
    try {
      const result = await authService.refresh(cookies.refreshToken);
      setSessionCookies(
        response,
        result.session,
        secureCookies,
        cookieSameSite,
      );
      return { accessToken: result.session.access_token, user: result.user };
    } catch {
      // Invalid sessions are cleared below.
    }
  }

  clearSessionCookies(response, secureCookies, cookieSameSite);
  return null;
}
