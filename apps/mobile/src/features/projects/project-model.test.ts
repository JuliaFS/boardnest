import { describe, expect, it } from 'vitest';

import {
  actionableProjectError,
  canManageProject,
  projectStatusLabel,
  validateProjectForm,
} from './project-model';

describe('mobile project model', () => {
  it('validates names and chronological dates', () => {
    expect(validateProjectForm('', '2026-12-10', '2026-12-01')).toEqual({
      dueDate: 'Due date cannot be before the start date.',
      name: 'Project name is required.',
    });
    expect(validateProjectForm('Launch', '2026-12-01', '2026-12-10')).toEqual(
      {},
    );
  });

  it('derives project management permissions from both role levels', () => {
    expect(canManageProject('OWNER', undefined)).toBe(true);
    expect(canManageProject('MEMBER', 'PROJECT_LEAD')).toBe(true);
    expect(canManageProject('VIEWER', 'PROJECT_LEAD')).toBe(false);
  });

  it('returns readable status and quota messages', () => {
    expect(projectStatusLabel('ON_HOLD')).toBe('On Hold');
    expect(actionableProjectError('Guest limit reached: 1 project.')).toContain(
      'Guest accounts can create one project',
    );
  });
});
