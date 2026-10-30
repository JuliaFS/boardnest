import { describe, expect, it } from 'vitest';

import { parseBearerAuthorization } from './session.js';

describe('Bearer authentication', () => {
  it('extracts a case-insensitive Bearer token', () => {
    expect(parseBearerAuthorization('bearer mobile.jwt-token')).toBe(
      'mobile.jwt-token',
    );
  });

  it.each([
    undefined,
    null,
    '',
    'Basic credentials',
    'Bearer',
    'Bearer token with spaces',
  ])('rejects malformed authorization value %s', (value) => {
    expect(parseBearerAuthorization(value)).toBeNull();
  });
});
