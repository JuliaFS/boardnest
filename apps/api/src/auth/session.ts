import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AuthService, PublicAuthUser } from './auth-service.js';
import {
  clearSessionCookies,
  readAuthCookies,
  setSessionCookies,
} from './cookies.js';

export interface RequestSession {
  accessToken: string;
  user: PublicAuthUser;
}

export async function resolveRequestSession(
  request: IncomingMessage,
  response: ServerResponse,
  authService: AuthService,
  secureCookies: boolean,
): Promise<RequestSession | null> {
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
      setSessionCookies(response, result.session, secureCookies);
      return { accessToken: result.session.access_token, user: result.user };
    } catch {
      // Invalid sessions are cleared below.
    }
  }

  clearSessionCookies(response, secureCookies);
  return null;
}
