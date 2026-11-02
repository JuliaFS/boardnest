import { describe, expect, it } from 'vitest';

import { canEditTasks, parseDueAt } from './task-model';

describe('mobile task model', () => {
  it('parses valid due dates and rejects invalid values', () => {
    expect(parseDueAt('')).toBeNull();
    expect(parseDueAt('not-a-date')).toBeUndefined();
    expect(parseDueAt('2030-01-02 10:30')).toContain('2030-01-02');
  });

  it('matches task editing permissions for workspace and private projects', () => {
    expect(canEditTasks('ADMIN', undefined, 'PRIVATE')).toBe(true);
    expect(canEditTasks('MEMBER', undefined, 'WORKSPACE')).toBe(true);
    expect(canEditTasks('MEMBER', 'MEMBER', 'PRIVATE')).toBe(true);
    expect(canEditTasks('MEMBER', 'VIEWER', 'WORKSPACE')).toBe(false);
    expect(canEditTasks('VIEWER', 'PROJECT_LEAD', 'PRIVATE')).toBe(false);
  });
});
