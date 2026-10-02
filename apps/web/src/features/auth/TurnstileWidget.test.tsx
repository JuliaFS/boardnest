import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TurnstileWidget } from './TurnstileWidget';

interface TurnstileOptions {
  callback: (token: string) => void;
  'error-callback': () => void;
  'expired-callback': () => void;
}

afterEach(() => {
  cleanup();
  delete window.turnstile;
});

describe('TurnstileWidget', () => {
  it('reports token changes, errors, and removes the rendered widget', async () => {
    const onTokenChange = vi.fn();
    const remove = vi.fn();
    let options: TurnstileOptions | undefined;
    const renderWidget = vi.fn(
      (_container: HTMLElement, nextOptions: TurnstileOptions) => {
        options = nextOptions;
        return 'widget-1';
      },
    );
    window.turnstile = {
      remove,
      render: renderWidget,
    };

    const view = render(
      <TurnstileWidget onTokenChange={onTokenChange} resetKey={0} />,
    );

    await waitFor(() => expect(renderWidget).toHaveBeenCalledOnce());
    expect(onTokenChange).toHaveBeenCalledWith(null);

    act(() => options?.callback('verified-token'));
    expect(onTokenChange).toHaveBeenLastCalledWith('verified-token');

    act(() => options?.['expired-callback']());
    expect(onTokenChange).toHaveBeenLastCalledWith(null);

    act(() => options?.['error-callback']());
    expect(screen.getByRole('alert').textContent).toBe(
      'The security check could not load. Refresh the page and try again.',
    );

    view.unmount();
    expect(remove).toHaveBeenCalledWith('widget-1');
  });
});
