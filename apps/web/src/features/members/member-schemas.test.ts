import { describe, expect, it } from 'vitest';

import { inviteMemberSchema } from './member-schemas';

describe('inviteMemberSchema', () => {
  it('normalizes an invitation email and accepts assignable roles', () => {
    expect(
      inviteMemberSchema.parse({
        email: '  PERSON@Example.COM ',
        role: 'MEMBER',
      }),
    ).toEqual({ email: 'person@example.com', role: 'MEMBER' });
  });

  it('rejects invalid email addresses and the owner role', () => {
    expect(
      inviteMemberSchema.safeParse({ email: 'invalid', role: 'OWNER' }).success,
    ).toBe(false);
  });
});
