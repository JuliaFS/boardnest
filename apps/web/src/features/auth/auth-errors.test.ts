import { describe, expect, it } from 'vitest';

import { getAuthErrorMessage } from './auth-errors';

describe('getAuthErrorMessage', () => {
  it('distinguishes an unavailable API from invalid credentials', () => {
    expect(getAuthErrorMessage(new TypeError('Failed to fetch'))).toBe(
      'Cannot reach the API. Make sure the backend is running and try again.',
    );
  });

  it('explains rejected CAPTCHA authentication attempts', () => {
    expect(
      getAuthErrorMessage(
        new Error(
          'captcha protection: request disallowed (no captcha_token found)',
        ),
      ),
    ).toBe('Complete the security check and try again.');
  });
});
