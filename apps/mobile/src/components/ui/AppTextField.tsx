import { forwardRef, type ComponentRef } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';

import { MIN_TOUCH_TARGET, theme } from '@/theme';

type AppTextFieldProps = TextInputProps & {
  error?: string | null;
  hint?: string;
  label: string;
};

export const AppTextField = forwardRef<
  ComponentRef<typeof TextInput>,
  AppTextFieldProps
>(function AppTextField({ error, hint, label, style, ...inputProps }, ref) {
  const description = error ?? hint;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityHint={description}
        accessibilityLabel={inputProps.accessibilityLabel ?? label}
        aria-invalid={Boolean(error)}
        placeholderTextColor={theme.colors.textMuted}
        ref={ref}
        style={[styles.input, error ? styles.inputError : null, style]}
      />
      {description ? (
        <Text
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          style={error ? styles.error : styles.hint}
        >
          {description}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  error: { color: theme.colors.danger, fontSize: 13, lineHeight: 18 },
  field: { gap: theme.spacing.sm },
  hint: { color: theme.colors.textMuted, fontSize: 13, lineHeight: 18 },
  input: {
    minHeight: MIN_TOUCH_TARGET,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: 16,
    paddingHorizontal: theme.spacing.md,
  },
  inputError: { borderColor: theme.colors.danger },
  label: { color: theme.colors.text, fontSize: 14, fontWeight: '700' },
});
