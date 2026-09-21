import { describe, expect, it } from 'vitest';

import {
  projectFormSchema,
  workspaceFormSchema,
  workspaceSlugFromName,
} from './project-schemas';

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

  it('generates a URL-safe workspace slug from an English name', () => {
    expect(workspaceSlugFromName('Frontend Product Team')).toBe(
      'frontend-product-team',
    );
  });

  it('transliterates a Bulgarian workspace name', () => {
    expect(workspaceSlugFromName('Моят работен екип')).toBe(
      'moyat-raboten-ekip',
    );
  });

  it('removes repeated separators and caps generated slugs at 63 characters', () => {
    const slug = workspaceSlugFromName(
      `  Product & Design ${'Team '.repeat(20)}`,
    );

    expect(slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(slug.length).toBeLessThanOrEqual(63);
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
