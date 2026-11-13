import { MockedProvider } from '@apollo/client/testing/react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { GraphQLError } from 'graphql';

import {
  CHANGE_INVITATION_EMAIL_MUTATION,
  type InvitationSummary,
} from '../core/graphql';
import { InviteMemberForm } from './InviteMemberForm';

afterEach(cleanup);
const invitation: InvitationSummary = {
  id: '6992c303-a240-4e15-8fcc-461d53756324',
  workspaceId: '35b70c1e-4b55-4a16-b85b-29c2fe513701',
  email: 'wrong@example.com',
  role: 'VIEWER',
  status: 'PENDING',
  expiresAt: '2030-01-01T00:00:00Z',
  createdAt: '2026-11-13T00:00:00Z',
};

it('prefills the address, preserves the role, and saves a normalized replacement email', async () => {
  const user = userEvent.setup();
  const onCompleted = vi.fn();
  const payload = {
    invitation: {
      ...invitation,
      id: invitation.workspaceId,
      email: 'correct@example.com',
    },
    emailSent: true,
    token: null,
  };
  render(
    <MockedProvider
      mocks={[
        {
          request: {
            query: CHANGE_INVITATION_EMAIL_MUTATION,
            variables: { id: invitation.id, email: 'correct@example.com' },
          },
          result: { data: { inviteMember: payload } },
        },
      ]}
    >
      <InviteMemberForm
        invitation={invitation}
        workspaceId={invitation.workspaceId}
        onCancel={vi.fn()}
        onCompleted={onCompleted}
      />
    </MockedProvider>,
  );
  const email = screen.getByLabelText<HTMLInputElement>('Email address');
  expect(email.value).toBe(invitation.email);
  expect(
    screen.getByLabelText<HTMLSelectElement>('Workspace role').disabled,
  ).toBe(true);
  await user.clear(email);
  await user.type(email, ' CORRECT@example.com ');
  await user.click(screen.getByRole('button', { name: 'Save email' }));
  await waitFor(() => expect(onCompleted).toHaveBeenCalledWith(payload));
});

it('keeps the edit form open when the replacement conflicts with another invitation', async () => {
  const user = userEvent.setup();
  const onCompleted = vi.fn();
  render(
    <MockedProvider
      mocks={[
        {
          request: {
            query: CHANGE_INVITATION_EMAIL_MUTATION,
            variables: { id: invitation.id, email: 'correct@example.com' },
          },
          result: {
            errors: [
              new GraphQLError(
                'A pending invitation already exists for this email in the workspace.',
              ).toJSON(),
            ],
          },
        },
      ]}
    >
      <InviteMemberForm
        invitation={invitation}
        workspaceId={invitation.workspaceId}
        onCancel={vi.fn()}
        onCompleted={onCompleted}
      />
    </MockedProvider>,
  );
  await user.clear(screen.getByLabelText('Email address'));
  await user.type(
    screen.getByLabelText('Email address'),
    'correct@example.com',
  );
  await user.click(screen.getByRole('button', { name: 'Save email' }));
  expect((await screen.findByRole('alert')).textContent).toContain(
    'already exists',
  );
  expect(onCompleted).not.toHaveBeenCalled();
});
