import { MobileWorkspacesDocument } from '@boardnest/graphql-types';
import { useQuery } from '@apollo/client/react';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  AppButton,
  AppScreen,
  EmptyState,
  ErrorState,
  LoadingState,
  useFeedback,
} from '@/components/ui';
import { WorkspaceFormSheet } from '@/features/workspaces/WorkspaceFormSheet';
import { mobileRoutes } from '@/navigation/routes';
import { MIN_TOUCH_TARGET, theme } from '@/theme';

export default function DashboardScreen() {
  const router = useRouter();
  const { showToast } = useFeedback();
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const { data, error, loading, refetch } = useQuery(MobileWorkspacesDocument, {
    fetchPolicy: 'cache-and-network',
  });
  const workspaces = data?.workspaces.nodes ?? [];

  return (
    <AppScreen
      description="Open a workspace to view its members, permissions, and projects."
      eyebrow="DASHBOARD"
      title="Your workspaces"
    >
      <AppButton
        label="Create workspace"
        onPress={() => setShowCreateWorkspace(true)}
      />
      {loading && !data ? (
        <LoadingState
          description="Loading the workspaces available to your account."
          title="Loading workspaces"
        />
      ) : null}
      {error && !data ? (
        <ErrorState
          actionLabel="Try again"
          description={error.message}
          onAction={() => void refetch()}
          title="Workspaces could not be loaded"
        />
      ) : null}
      {!loading && !error && workspaces.length === 0 ? (
        <EmptyState
          actionLabel="Create your first workspace"
          description="A workspace contains members, projects, tasks, and notifications."
          onAction={() => setShowCreateWorkspace(true)}
          title="No workspaces yet"
        />
      ) : null}
      {workspaces.length > 0 ? (
        <View accessibilityRole="list" style={styles.list}>
          {workspaces.map((workspace) => (
            <Pressable
              accessibilityHint="Opens workspace details and members"
              accessibilityLabel={`${workspace.name}, workspace`}
              accessibilityRole="button"
              key={workspace.id}
              onPress={() => router.push(mobileRoutes.workspace(workspace.id))}
              style={({ pressed }) => [
                styles.card,
                pressed && styles.cardPressed,
              ]}
            >
              <View style={styles.cardHeading}>
                <Text style={styles.cardTitle}>{workspace.name}</Text>
                <Text accessibilityElementsHidden style={styles.arrow}>
                  ›
                </Text>
              </View>
              <Text style={styles.slug}>/{workspace.slug}</Text>
              <Text style={styles.updatedAt}>
                Updated {new Date(workspace.updatedAt).toLocaleDateString()}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <WorkspaceFormSheet
        onClose={() => setShowCreateWorkspace(false)}
        onCompleted={(workspace) => {
          setShowCreateWorkspace(false);
          showToast({
            message: `${workspace.name} was created.`,
            tone: 'success',
          });
          router.push(mobileRoutes.workspace(workspace.id));
        }}
        visible={showCreateWorkspace}
      />
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  arrow: { color: theme.colors.primary, fontSize: 30 },
  card: {
    minHeight: MIN_TOUCH_TARGET,
    gap: theme.spacing.sm,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.lg,
  },
  cardHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  cardPressed: { opacity: 0.72 },
  cardTitle: {
    flex: 1,
    color: theme.colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  list: { gap: theme.spacing.md },
  slug: { color: theme.colors.primary, fontSize: 14, fontWeight: '700' },
  updatedAt: { color: theme.colors.textMuted, fontSize: 13 },
});
