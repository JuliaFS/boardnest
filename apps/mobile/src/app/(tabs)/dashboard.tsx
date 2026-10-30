import { MobileConnectionDocument } from '@boardnest/graphql-types';
import { useQuery } from '@apollo/client/react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FoundationScreen } from '@/components/foundation-screen';
import { mobileEnvironment } from '@/lib/environment';
import { theme } from '@/theme';

export default function DashboardScreen() {
  const { data, error, loading, refetch } = useQuery(MobileConnectionDocument, {
    fetchPolicy: 'network-only',
  });
  const currentUser = data?.currentUser;

  const connectionState = loading
    ? 'Checking the shared GraphQL API…'
    : error
      ? 'The GraphQL API could not be reached.'
      : 'The shared GraphQL contract is connected.';

  return (
    <FoundationScreen
      eyebrow="MOBILE GRAPHQL"
      title="Welcome to Boardnest"
      description="The native client uses the shared GraphQL contract and is ready for authentication."
      items={[
        'Expo Router navigation is configured.',
        'Generated GraphQL types are shared with the web client.',
        'Android, iOS, and web development targets are enabled.',
      ]}
    >
      <View accessibilityLiveRegion="polite" style={styles.connectionCard}>
        <View style={styles.connectionHeader}>
          <View
            style={[
              styles.statusMarker,
              loading
                ? styles.statusPending
                : error
                  ? styles.statusError
                  : styles.statusReady,
            ]}
          />
          <Text style={styles.connectionTitle}>GraphQL connection</Text>
        </View>
        <Text style={styles.connectionText}>{connectionState}</Text>
        {!mobileEnvironment.hasConfiguredGraphqlUrl ? (
          <Text style={styles.configurationHint}>
            Using the localhost default. Configure EXPO_PUBLIC_GRAPHQL_URL for a
            physical device.
          </Text>
        ) : null}
        {!loading && !error ? (
          <Text style={styles.connectionDetail}>
            {currentUser
              ? `Session detected for ${currentUser.displayName ?? currentUser.email ?? currentUser.id}.`
              : 'The public query completed without an authenticated session.'}
          </Text>
        ) : null}
        {error ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => void refetch()}
            style={({ pressed }) => [
              styles.retryButton,
              pressed && styles.retryButtonPressed,
            ]}
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        ) : null}
      </View>
    </FoundationScreen>
  );
}

const styles = StyleSheet.create({
  connectionCard: {
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceElevated,
  },
  connectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  statusMarker: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusReady: {
    backgroundColor: theme.colors.success,
  },
  statusPending: {
    backgroundColor: theme.colors.primary,
  },
  statusError: {
    backgroundColor: theme.colors.danger,
  },
  connectionTitle: {
    color: theme.colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  connectionText: {
    color: theme.colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  connectionDetail: {
    color: theme.colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  configurationHint: {
    color: theme.colors.primary,
    fontSize: 13,
    lineHeight: 19,
  },
  retryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary,
  },
  retryButtonPressed: {
    opacity: 0.8,
  },
  retryButtonText: {
    color: theme.colors.primaryContrast,
    fontSize: 15,
    fontWeight: '800',
  },
});
