import { describe, expect, it } from 'vitest';

import { MIN_TOUCH_TARGET, theme } from '../theme';

import { mobileRoutes } from './routes';

describe('mobile navigation contracts', () => {
  it('builds encoded workspace, project, and task routes', () => {
    expect(mobileRoutes.workspace('workspace one')).toBe(
      '/workspaces/workspace%20one',
    );
    expect(mobileRoutes.project('project/one')).toBe('/projects/project%2Fone');
    expect(mobileRoutes.task('project one', 'task/two')).toBe(
      '/projects/project%20one/tasks/task%2Ftwo',
    );
  });

  it('keeps interactive controls at an accessible minimum size', () => {
    expect(MIN_TOUCH_TARGET).toBeGreaterThanOrEqual(44);
  });

  it('provides distinct semantic feedback colors', () => {
    expect(
      new Set([theme.colors.danger, theme.colors.success, theme.colors.warning])
        .size,
    ).toBe(3);
  });
});
