import { MockedProvider } from '@apollo/client/testing/react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CREATE_TASK_MUTATION } from '../core/graphql';
import { TaskForm } from './TaskForm';

afterEach(cleanup);

describe('TaskForm', () => {
  it('creates a task with normalized form values', async () => {
    const user = userEvent.setup();
    const onCompleted = vi.fn();
    const projectId = 'f2410cb7-47f6-4af6-8ed9-f1d7a45158fc';
    const statusId = '6954de6d-ed8e-4409-8be8-9e0ce72ba8c4';
    const task = {
      description: 'Release checklist',
      dueAt: null,
      id: 'ae248328-e9e4-4416-a92d-47af95406e4d',
      position: 2000,
      priority: 'HIGH' as const,
      projectId,
      statusId,
      title: 'Prepare release',
      updatedAt: new Date(0).toISOString(),
    };
    render(
      <MockedProvider
        mocks={[
          {
            request: {
              query: CREATE_TASK_MUTATION,
              variables: {
                input: {
                  description: task.description,
                  dueAt: null,
                  position: task.position,
                  priority: task.priority,
                  projectId,
                  statusId,
                  title: task.title,
                },
              },
            },
            result: { data: { createTask: task } },
          },
        ]}
      >
        <TaskForm
          initialPosition={task.position}
          onCancel={vi.fn()}
          onCompleted={onCompleted}
          projectId={projectId}
          statusId={statusId}
        />
      </MockedProvider>,
    );

    await user.type(screen.getByLabelText('Task title'), ` ${task.title} `);
    await user.type(screen.getByLabelText('Description'), task.description);
    await user.selectOptions(screen.getByLabelText('Priority'), task.priority);
    await user.click(screen.getByRole('button', { name: 'Create task' }));

    await waitFor(() => expect(onCompleted).toHaveBeenCalledWith(task));
  });
});
