import type { ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/ui/AppButton';
import { theme } from '@/theme';

type StateProps = {
  actionLabel?: string;
  description: string;
  onAction?: () => void;
  title: string;
};

function StateContainer({
  actionLabel,
  children,
  description,
  onAction,
  title,
}: StateProps & { children?: ReactNode }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.container}>
      {children}
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction ? (
        <AppButton label={actionLabel} onPress={onAction} variant="secondary" />
      ) : null}
    </View>
  );
}

export function LoadingState({
  description = 'Please wait while the content loads.',
  title = 'Loading',
}: Partial<Pick<StateProps, 'description' | 'title'>>) {
  return (
    <StateContainer description={description} title={title}>
      <ActivityIndicator
        accessibilityLabel={title}
        color={theme.colors.primary}
        size="large"
      />
    </StateContainer>
  );
}

export function ErrorState(props: StateProps) {
  return <StateContainer {...props} />;
}

export function EmptyState(props: StateProps) {
  return <StateContainer {...props} />;
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: theme.spacing.md,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
  },
  description: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.body,
    lineHeight: theme.typography.bodyLineHeight,
    textAlign: 'center',
  },
  title: {
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
});
