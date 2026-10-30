import { StyleSheet, Text, View } from 'react-native';

import { theme } from '@/theme';

type AppBannerProps = {
  message: string;
  title?: string;
  tone?: 'error' | 'info' | 'success' | 'warning';
};

export function AppBanner({ message, title, tone = 'info' }: AppBannerProps) {
  return (
    <View
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
      style={[styles.banner, styles[tone]]}
    >
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    gap: theme.spacing.xs,
    borderLeftWidth: 4,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surfaceElevated,
    padding: theme.spacing.md,
  },
  error: { borderLeftColor: theme.colors.danger },
  info: { borderLeftColor: theme.colors.primary },
  message: { color: theme.colors.textMuted, fontSize: 14, lineHeight: 20 },
  success: { borderLeftColor: theme.colors.success },
  title: { color: theme.colors.text, fontSize: 15, fontWeight: '800' },
  warning: { borderLeftColor: theme.colors.warning },
});
