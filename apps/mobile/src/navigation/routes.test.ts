import { describe, expect, it } from 'vitest';

import { MIN_TOUCH_TARGET, theme } from '../theme';

import { invitationRouteFromReturnTo, mobileRoutes } from './routes';

describe('mobile navigation contracts', () => {
  it('builds encoded workspace, project, and task routes', () => {
    expect(mobileRoutes.workspace('workspace one')).toBe(
      '/workspaces/workspace%20one',
    );
    expect(mobileRoutes.project('project/one')).toBe('/projects/project%2Fone');
    expect(mobileRoutes.board('project/one')).toBe(
      '/projects/project%2Fone/board',
    );
    expect(mobileRoutes.invitation('token/value')).toBe(
      '/invite/token%2Fvalue',
    );
    expect(mobileRoutes.task('project one', 'task/two')).toBe(
      '/projects/project%20one/tasks/task%2Ftwo',
    );
  });

  it('accepts only safe invitation return routes', () => {
    const token = 'a'.repeat(43);
    expect(invitationRouteFromReturnTo(`/invite/${token}`)).toBe(
      `/invite/${token}`,
    );
    expect(invitationRouteFromReturnTo('https://example.com')).toBeNull();
    expect(invitationRouteFromReturnTo('/projects/one')).toBeNull();
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
