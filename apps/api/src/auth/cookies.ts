import type { IncomingMessage, ServerResponse } from 'node:http';

import type { Session } from '@supabase/supabase-js';

const accessCookieName = 'boardnest-access';
const refreshCookieName = 'boardnest-refresh';
const refreshCookieMaxAge = 60 * 60 * 24 * 400;
const pkceCookieMaxAge = 60 * 60 * 24;

interface CookieOptions {
  maxAge: number;
  sameSite: CookieSameSite;
  secure: boolean;
}

export type CookieSameSite = 'Lax' | 'None';

export interface AuthCookies {
  accessToken: string | null;
  refreshToken: string | null;
}

export function readAuthCookies(request: IncomingMessage): AuthCookies {
  const cookies = parseCookies(request.headers.cookie);
  return {
    accessToken: cookies.get(accessCookieName) ?? null,
    refreshToken: cookies.get(refreshCookieName) ?? null,
  };
}

export function setSessionCookies(
  response: ServerResponse,
  session: Session,
  secure: boolean,
  sameSite: CookieSameSite = 'Lax',
): void {
  appendCookie(response, accessCookieName, session.access_token, {
    maxAge: session.expires_in,
    sameSite,
    secure,
  });
  appendCookie(response, refreshCookieName, session.refresh_token, {
    maxAge: refreshCookieMaxAge,
    sameSite,
    secure,
  });
  preventCaching(response);
}

export function clearSessionCookies(
  response: ServerResponse,
  secure: boolean,
  sameSite: CookieSameSite = 'Lax',
): void {
  appendCookie(response, accessCookieName, '', { maxAge: 0, sameSite, secure });
  appendCookie(response, refreshCookieName, '', {
    maxAge: 0,
    sameSite,
    secure,
  });
  preventCaching(response);
}

export class PkceCookieStorage {
  readonly isServer = true;
  readonly #cookies: Map<string, string>;
  readonly #response: ServerResponse;
  readonly #sameSite: CookieSameSite;
  readonly #secure: boolean;

  constructor(
    request: IncomingMessage,
    response: ServerResponse,
    secure: boolean,
    sameSite: CookieSameSite = 'Lax',
  ) {
    this.#cookies = parseCookies(request.headers.cookie);
    this.#response = response;
    this.#sameSite = sameSite;
    this.#secure = secure;
  }

  getItem(key: string): string | null {
    if (!isPkceStorageKey(key)) return null;
    return this.#cookies.get(toPkceCookieName(key)) ?? null;
  }

  setItem(key: string, value: string): void {
    if (!isPkceStorageKey(key)) return;
    const name = toPkceCookieName(key);
    this.#cookies.set(name, value);
    appendCookie(this.#response, name, value, {
      maxAge: pkceCookieMaxAge,
      sameSite: this.#sameSite,
      secure: this.#secure,
    });
    preventCaching(this.#response);
  }

  removeItem(key: string): void {
    if (!isPkceStorageKey(key)) return;
    const name = toPkceCookieName(key);
    this.#cookies.delete(name);
    appendCookie(this.#response, name, '', {
      maxAge: 0,
      sameSite: this.#sameSite,
      secure: this.#secure,
    });
    preventCaching(this.#response);
  }
}

function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>();

  for (const part of header?.split(';') ?? []) {
    const separator = part.indexOf('=');
    if (separator < 1) continue;
    const name = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    try {
      cookies.set(name, decodeURIComponent(value));
    } catch {
      // Ignore malformed cookies supplied by the client.
    }
  }

  return cookies;
}

function appendCookie(
  response: ServerResponse,
  name: string,
  value: string,
  { maxAge, sameSite, secure }: CookieOptions,
): void {
  const cookie = [
    `${name}=${encodeURIComponent(value)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    `SameSite=${sameSite}`,
    ...(secure ? ['Secure'] : []),
  ].join('; ');
  const current = response.getHeader('set-cookie');
  const cookies = Array.isArray(current)
    ? [...current.map(String), cookie]
    : current
      ? [String(current), cookie]
      : [cookie];
  response.setHeader('set-cookie', cookies);
}

function isPkceStorageKey(key: string): boolean {
  return key.endsWith('-code-verifier');
}

function toPkceCookieName(key: string): string {
  return `boardnest-pkce-${Buffer.from(key).toString('base64url')}`;
}

function preventCaching(response: ServerResponse): void {
  response.setHeader('cache-control', 'private, no-store');
  response.setHeader('pragma', 'no-cache');
}
