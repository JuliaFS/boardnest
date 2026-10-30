import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { mobileEnvironment } from '@/lib/environment';
import { theme } from '@/theme';

type TurnstileChallengeProps = {
  onToken: (token: string | null) => void;
};

export function TurnstileChallenge({ onToken }: TurnstileChallengeProps) {
  const html = useMemo(
    () => createTurnstileHtml(mobileEnvironment.turnstileSiteKey),
    [],
  );

  if (!mobileEnvironment.turnstileSiteKey) {
    return (
      <Text style={styles.configurationWarning}>
        CAPTCHA is disabled locally. Configure EXPO_PUBLIC_TURNSTILE_SITE_KEY
        when CAPTCHA protection is enabled in Supabase.
      </Text>
    );
  }

  function handleMessage(event: WebViewMessageEvent) {
    const message: unknown = event.nativeEvent.data;
    if (typeof message !== 'string') return;

    try {
      const payload: unknown = JSON.parse(message);
      if (!isTurnstileMessage(payload)) return;
      onToken(
        payload.type === 'success' && typeof payload.token === 'string'
          ? payload.token
          : null,
      );
    } catch {
      onToken(null);
    }
  }

  return (
    <View accessibilityLabel="Security verification" style={styles.frame}>
      <WebView
        javaScriptEnabled
        onMessage={handleMessage}
        originWhitelist={['https://*']}
        source={{ baseUrl: mobileEnvironment.webUrl, html }}
        style={styles.webView}
      />
    </View>
  );
}

function createTurnstileHtml(siteKey: string | null): string {
  const serializedKey = JSON.stringify(siteKey ?? '');
  return `<!doctype html>
<html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
<style>html,body{margin:0;background:#11182b;color:#f8faff}body{display:flex;align-items:center;justify-content:center;min-height:76px}</style>
</head><body><div class="cf-turnstile" data-sitekey=${serializedKey}
data-theme="dark" data-callback="success" data-expired-callback="expired" data-error-callback="failed"></div>
<script>
function send(value){window.ReactNativeWebView.postMessage(JSON.stringify(value))}
function success(token){send({type:'success',token:token})}
function expired(){send({type:'expired'})}
function failed(){send({type:'error'})}
</script></body></html>`;
}

function isTurnstileMessage(
  value: unknown,
): value is { token?: string; type: 'error' | 'expired' | 'success' } {
  if (typeof value !== 'object' || value === null || !('type' in value)) {
    return false;
  }
  const type = value.type;
  return type === 'success' || type === 'expired' || type === 'error';
}

const styles = StyleSheet.create({
  configurationWarning: {
    color: theme.colors.textMuted,
    fontSize: 12,
    lineHeight: 18,
  },
  frame: {
    height: 84,
    overflow: 'hidden',
    borderRadius: theme.radius.md,
    borderColor: theme.colors.border,
    borderWidth: 1,
  },
  webView: {
    backgroundColor: theme.colors.surface,
  },
});
