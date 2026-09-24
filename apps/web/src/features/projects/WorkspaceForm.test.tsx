import { MockedProvider } from '@apollo/client/testing/react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CREATE_WORKSPACE_MUTATION } from '../core/graphql';
import { WorkspaceForm } from './WorkspaceForm';

afterEach(cleanup);

describe('WorkspaceForm', () => {
  it('generates a slug from the name and submits the created workspace', async () => {
    const user = userEvent.setup();
    const onCompleted = vi.fn();
    const workspace = {
      id: '6992c303-a240-4e15-8fcc-461d53756324',
      name: 'Моят екип',
      slug: 'moyat-ekip',
      updatedAt: new Date(0).toISOString(),
    };
    render(
      <MockedProvider
        mocks={[
          {
            request: {
              query: CREATE_WORKSPACE_MUTATION,
              variables: {
                input: { name: workspace.name, slug: workspace.slug },
              },
            },
            result: { data: { createWorkspace: workspace } },
          },
        ]}
      >
        <WorkspaceForm onCancel={vi.fn()} onCompleted={onCompleted} />
      </MockedProvider>,
    );

    await user.type(screen.getByLabelText('Workspace name'), workspace.name);
    expect(
      screen.getByPlaceholderText<HTMLInputElement>('product-team').value,
    ).toBe(workspace.slug);
    await user.click(screen.getByRole('button', { name: 'Create workspace' }));

    await waitFor(() => expect(onCompleted).toHaveBeenCalledWith(workspace));
  });

  it('stops auto-generating after the user edits the slug', async () => {
    const user = userEvent.setup();
    render(
      <MockedProvider>
        <WorkspaceForm onCancel={vi.fn()} onCompleted={vi.fn()} />
      </MockedProvider>,
    );

    await user.type(screen.getByLabelText('Workspace name'), 'Product');
    const slug = screen.getByPlaceholderText<HTMLInputElement>('product-team');
    await user.clear(slug);
    await user.type(slug, 'custom-team');
    await user.type(screen.getByLabelText('Workspace name'), ' Group');

    expect(slug.value).toBe('custom-team');
  });
});
