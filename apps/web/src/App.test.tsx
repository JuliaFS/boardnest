import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { App } from './App';

const { authState } = vi.hoisted(() => ({
  authState: {
    continueAsGuest: vi.fn(),
    isLoading: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
    signUp: vi.fn(),
    user: null,
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
