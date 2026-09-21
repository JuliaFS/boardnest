import { describe, expect, it } from 'vitest';

import { taskFormSchema } from './task-schema';

describe('task form', () => {
  it('requires a non-empty title', () => {
    expect(
      taskFormSchema.safeParse({
        description: '',
        dueAt: '',
        priority: 'MEDIUM',
        title: '   ',
      }).success,
    ).toBe(false);
  });

  it('accepts all supported task priorities', () => {
    for (const priority of ['NONE', 'LOW', 'MEDIUM', 'HIGH', 'URGENT']) {
      expect(
        taskFormSchema.safeParse({
          description: '',
          dueAt: '',
          priority,
          title: 'Prepare release',
        }).success,
      ).toBe(true);
    }
  });
});
