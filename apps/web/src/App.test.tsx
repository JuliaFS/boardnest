import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { App } from './App';

describe('App', () => {
  it('identifies the product and current foundation state', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', {
        name: 'Plan together. Move work forward.',
      }),
    ).toBeTruthy();
    expect(screen.getByText('Boardnest')).toBeTruthy();
  });
});
