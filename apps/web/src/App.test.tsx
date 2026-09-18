import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App';

const { authState } = vi.hoisted(() => ({
  authState: {
    isLoading: false,
    session: null,
    signIn: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
  },
}));

vi.mock('./features/auth/AuthProvider', () => ({
  useAuth: () => authState,
}));

describe('App routing', () => {
  it('redirects an anonymous visitor from a protected page to sign in', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeTruthy();
  });
});
