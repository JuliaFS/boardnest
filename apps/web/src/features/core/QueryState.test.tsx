import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EmptyState } from './QueryState';

describe('EmptyState', () => {
  it('exposes the primary empty-state action through the plus and text buttons', () => {
    const onAction = vi.fn();

    render(
      <EmptyState
        actionLabel="Create workspace"
        description="Start organizing projects."
        onAction={onAction}
        title="No workspaces"
      />,
    );

    const actions = screen.getAllByRole('button', { name: 'Create workspace' });
    expect(actions).toHaveLength(2);
    fireEvent.click(actions[0]!);
    fireEvent.click(actions[1]!);
    expect(onAction).toHaveBeenCalledTimes(2);
  });
});
