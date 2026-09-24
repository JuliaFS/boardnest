import { MockedProvider } from '@apollo/client/testing/react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ProjectForm } from './ProjectForm';

afterEach(cleanup);

describe('ProjectForm', () => {
  it('shows a useful validation error when the due date is before the start date', async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider>
        <ProjectForm
          onCancel={vi.fn()}
          onCompleted={vi.fn()}
          workspaceId="6992c303-a240-4e15-8fcc-461d53756324"
        />
      </MockedProvider>,
    );

    await user.type(screen.getByLabelText('Project name'), 'Launch');
    await user.type(screen.getByLabelText('Start date'), '2026-09-30');
    await user.type(screen.getByLabelText('Due date'), '2026-09-20');
    await user.click(screen.getByRole('button', { name: 'Create project' }));

    expect(
      await screen.findByText('Due date cannot be before the start date.'),
    ).toBeTruthy();
  });
});
