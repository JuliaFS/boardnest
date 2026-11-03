import { CreateMobileWorkspaceDocument } from '@boardnest/graphql-types';
import type { MockedResponse } from '@apollo/client/testing';
import { MockedProvider } from '@apollo/client/testing/react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ProjectFormSheet } from '@/features/projects/ProjectFormSheet';
import { TaskFormSheet } from '@/features/tasks/TaskFormSheet';
import { WorkspaceFormSheet } from '@/features/workspaces/WorkspaceFormSheet';

describe('mobile entity forms', () => {
  test('generates a workspace slug and validates an empty submission', async () => {
    const screen = await render(
      <MockedProvider>
        <WorkspaceFormSheet
          onClose={jest.fn()}
          onCompleted={jest.fn()}
          visible
        />
      </MockedProvider>,
    );
    await fireEvent.changeText(
      screen.getByLabelText('Workspace name'),
      'Product Team',
    );
    expect(screen.getByLabelText('URL slug').props.value).toBe('product-team');
    await fireEvent.changeText(screen.getByLabelText('Workspace name'), '');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Create workspace' }),
    );
    expect(screen.getByText('Workspace name is required.')).toBeTruthy();
  });

  test('rejects project dates in reverse chronological order', async () => {
    const screen = await render(
      <MockedProvider>
        <ProjectFormSheet
          onClose={jest.fn()}
          onCompleted={jest.fn()}
          visible
          workspaceId="workspace-id"
        />
      </MockedProvider>,
    );
    await fireEvent.changeText(screen.getByLabelText('Project name'), 'Launch');
    await fireEvent.changeText(
      screen.getByLabelText('Start date'),
      '2030-12-10',
    );
    await fireEvent.changeText(screen.getByLabelText('Due date'), '2030-12-01');
    await fireEvent.press(
      screen.getByRole('button', { name: 'Create project' }),
    );
    expect(
      screen.getByText('Due date cannot be before the start date.'),
    ).toBeTruthy();
  });

  test('requires a task title and validates the due date', async () => {
    const screen = await render(
      <MockedProvider>
        <TaskFormSheet
          onClose={jest.fn()}
          onCompleted={jest.fn()}
          projectId="project-id"
          statusId="status-id"
          visible
        />
      </MockedProvider>,
    );
    await fireEvent.changeText(
      screen.getByLabelText('Due date and time'),
      'invalid',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Create task' }));
    expect(screen.getByText('Enter a task title.')).toBeTruthy();
    expect(
      screen.getByText(
        'Use a valid date and time, for example 2030-01-02 10:30.',
      ),
    ).toBeTruthy();
  });

  test('submits a typed Apollo mutation and reports GraphQL errors', async () => {
    const onCompleted = jest.fn();
    const successMock: MockedResponse = {
      request: {
        query: CreateMobileWorkspaceDocument,
        variables: { input: { name: 'Product Team', slug: 'product-team' } },
      },
      result: {
        data: {
          createWorkspace: {
            createdAt: '2030-01-01T00:00:00.000Z',
            createdBy: 'user-id',
            id: 'workspace-id',
            name: 'Product Team',
            slug: 'product-team',
            updatedAt: '2030-01-01T00:00:00.000Z',
          },
        },
      },
    };
    const success = await render(
      <MockedProvider mocks={[successMock]}>
        <WorkspaceFormSheet
          onClose={jest.fn()}
          onCompleted={onCompleted}
          visible
        />
      </MockedProvider>,
    );
    await fireEvent.changeText(
      success.getByLabelText('Workspace name'),
      'Product Team',
    );
    await fireEvent.press(
      success.getByRole('button', { name: 'Create workspace' }),
    );
    await waitFor(() =>
      expect(onCompleted).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Product Team', slug: 'product-team' }),
      ),
    );
    await success.unmount();

    const errorMock: MockedResponse = {
      request: successMock.request,
      error: new Error('This workspace slug is already in use.'),
    };
    const failure = await render(
      <MockedProvider mocks={[errorMock]}>
        <WorkspaceFormSheet
          onClose={jest.fn()}
          onCompleted={jest.fn()}
          visible
        />
      </MockedProvider>,
    );
    await fireEvent.changeText(
      failure.getByLabelText('Workspace name'),
      'Product Team',
    );
    await fireEvent.press(
      failure.getByRole('button', { name: 'Create workspace' }),
    );
    expect(
      await failure.findByText('This workspace slug is already in use.'),
    ).toBeTruthy();
  });
});
