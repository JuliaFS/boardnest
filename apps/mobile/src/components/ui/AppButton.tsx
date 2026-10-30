import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { MIN_TOUCH_TARGET, theme } from '@/theme';

type AppButtonProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
  variant?: 'danger' | 'ghost' | 'primary' | 'secondary';
};

export function AppButton({
  accessibilityLabel,
  disabled = false,
  label,
  loading = false,
  onPress,
  variant = 'primary',
}: AppButtonProps) {
  const unavailable = disabled || loading;

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: unavailable }}
      disabled={unavailable}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        (pressed || unavailable) && styles.dimmed,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          color={
            variant === 'primary' || variant === 'danger'
              ? theme.colors.primaryContrast
              : theme.colors.text
          }
        />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'primary' || variant === 'danger'
              ? styles.solidLabel
              : styles.outlineLabel,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  danger: {
    borderColor: theme.colors.danger,
    backgroundColor: theme.colors.danger,
  },
  dimmed: { opacity: 0.55 },
  ghost: {
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  label: { fontSize: 16, fontWeight: '800' },
  outlineLabel: { color: theme.colors.text },
  primary: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primary,
  },
  secondary: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  solidLabel: { color: theme.colors.primaryContrast },
});
