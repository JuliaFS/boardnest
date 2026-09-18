import { describe, expect, it } from 'vitest';

import { isWorkspaceRole } from './index.js';

describe('isWorkspaceRole', () => {
  it.each(['owner', 'admin', 'member', 'viewer'])(
    'accepts the %s role',
    (role) => {
      expect(isWorkspaceRole(role)).toBe(true);
    },
  );

  it('rejects unknown roles', () => {
    expect(isWorkspaceRole('super-admin')).toBe(false);
  });
});
