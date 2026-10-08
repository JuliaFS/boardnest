import { useEffect, useRef, useState } from 'react';

import { publicEnvironment } from '../../lib/env';

interface TurnstileApi {
  remove: (widgetId: string) => void;
  render: (
    container: HTMLElement,
    options: {
      action: string;
      callback: (token: string) => void;
      'error-callback': () => void;
      'expired-callback': () => void;
      sitekey: string;
      theme: 'dark';
    },
  ) => string;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

export function TurnstileWidget({
  action,
  onTokenChange,
  resetKey,
}: {
  action: string;
  onTokenChange: (token: string | null) => void;
  resetKey: number;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    let widgetId: string | null = null;
    onTokenChange(null);
    setLoadError(false);

    void loadTurnstile()
      .then((turnstile) => {
        if (!active || !container.current) return;
        widgetId = turnstile.render(container.current, {
          action,
          callback: (token) => onTokenChange(token),
          'error-callback': () => {
            onTokenChange(null);
            setLoadError(true);
          },
          'expired-callback': () => onTokenChange(null),
          sitekey: publicEnvironment.VITE_TURNSTILE_SITE_KEY,
          theme: 'dark',
        });
      })
      .catch(() => {
        if (active) setLoadError(true);
      });

    return () => {
      active = false;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [action, onTokenChange, resetKey]);

  return (
    <div className="turnstile-shell">
      <div aria-label="Security verification" ref={container} />
      {loadError ? (
        <p className="form-message error-message" role="alert">
          The security check could not load. Refresh the page and try again.
        </p>
      ) : null}
    </div>
  );
}

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (scriptPromise) return scriptPromise;

  const loading = new Promise<TurnstileApi>((resolve, reject) => {
    const staleScript = document.querySelector<HTMLScriptElement>(
      'script[data-boardnest-turnstile]',
    );
    staleScript?.remove();
    const script = document.createElement('script');
    const handleLoad = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error('Turnstile API did not initialize.'));
    };
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener(
      'error',
      () => reject(new Error('Turnstile script failed to load.')),
      { once: true },
    );

    script.async = true;
    script.dataset.boardnestTurnstile = 'true';
    script.defer = true;
    script.src =
      'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    document.head.append(script);
  });
  const result = loading.catch((error: unknown): never => {
    scriptPromise = null;
    throw error;
  });
  scriptPromise = result;
  return result;
}
