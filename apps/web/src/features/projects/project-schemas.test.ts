import { describe, expect, it } from 'vitest';

import { projectFormSchema, workspaceFormSchema } from './project-schemas';

describe('project forms', () => {
  it('accepts a valid workspace slug', () => {
    expect(
      workspaceFormSchema.safeParse({ name: 'Product', slug: 'product-team' })
        .success,
    ).toBe(true);
  });

  it('rejects malformed workspace slugs', () => {
    expect(
      workspaceFormSchema.safeParse({ name: 'Product', slug: 'Product Team' })
        .success,
    ).toBe(false);
  });

  it('rejects a project due date before its start date', () => {
    expect(
      projectFormSchema.safeParse({
        description: '',
        dueDate: '2026-01-01',
        name: 'Launch',
        startDate: '2026-02-01',
        status: 'ACTIVE',
        visibility: 'PRIVATE',
      }).success,
    ).toBe(false);
  });
});
