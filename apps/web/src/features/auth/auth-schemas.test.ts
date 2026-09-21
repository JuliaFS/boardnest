import { describe, expect, it } from 'vitest';

import { loginSchema, registerSchema } from './auth-schemas';

describe('authentication schemas', () => {
  it('accepts valid login credentials', () => {
    expect(
      loginSchema.safeParse({ email: 'person@example.com', password: 'secret' })
        .success,
    ).toBe(true);
  });

  it('rejects a weak registration password', () => {
    const result = registerSchema.safeParse({
      confirmPassword: 'password',
      displayName: 'Test User',
      email: 'person@example.com',
      password: 'password',
    });

    expect(result.success).toBe(false);
  });

  it('requires matching registration passwords', () => {
    const result = registerSchema.safeParse({
      confirmPassword: 'Different2',
      displayName: 'Test User',
      email: 'person@example.com',
      password: 'StrongPass1',
    });

    expect(result.success).toBe(false);
  });
});
