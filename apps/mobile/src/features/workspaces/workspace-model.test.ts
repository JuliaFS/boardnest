import { describe, expect, it } from 'vitest';

import {
  canManageWorkspace,
  validateWorkspaceForm,
  workspaceRoleDescription,
  workspaceSlugFromName,
} from './workspace-model';

describe('mobile workspace model', () => {
  it('generates a safe slug from Bulgarian and English names', () => {
    expect(workspaceSlugFromName('Моят Product Екип')).toBe(
      'moyat-product-ekip',
    );
  });

  it('validates names and URL slugs', () => {
    expect(validateWorkspaceForm('', 'Bad Slug')).toEqual({
      name: 'Workspace name is required.',
      slug: 'Use lowercase letters, numbers, and single hyphens.',
    });
    expect(validateWorkspaceForm('Product', 'product-team')).toEqual({});
  });

  it('allows only owners and admins to manage workspace settings', () => {
    expect(canManageWorkspace('OWNER')).toBe(true);
    expect(canManageWorkspace('ADMIN')).toBe(true);
    expect(canManageWorkspace('MEMBER')).toBe(false);
    expect(canManageWorkspace('VIEWER')).toBe(false);
    expect(workspaceRoleDescription('VIEWER')).toContain('view');
  });
});
