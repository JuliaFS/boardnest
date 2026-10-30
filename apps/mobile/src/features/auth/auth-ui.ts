import { StyleSheet } from 'react-native';

import { theme } from '@/theme';

export const authStyles = StyleSheet.create({
  actions: {
    gap: theme.spacing.md,
  },
  button: {
    minHeight: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.lg,
  },
  buttonDanger: {
    backgroundColor: theme.colors.danger,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: theme.colors.primaryContrast,
    fontSize: 16,
    fontWeight: '800',
  },
  card: {
    gap: theme.spacing.md,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
  },
  description: {
    color: theme.colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
  },
  error: {
    color: theme.colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  field: {
    gap: theme.spacing.sm,
  },
  input: {
    minHeight: 50,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontSize: 16,
    paddingHorizontal: theme.spacing.md,
  },
  label: {
    color: theme.colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  link: {
    color: theme.colors.primary,
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  page: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: theme.spacing.xl,
    padding: theme.spacing.lg,
  },
  status: {
    color: theme.colors.success,
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    color: theme.colors.text,
    fontSize: 34,
    fontWeight: '800',
  },
});
