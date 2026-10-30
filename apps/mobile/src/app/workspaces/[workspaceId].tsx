import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppScreen, EmptyState } from '@/components/ui';

export default function WorkspaceDetailsScreen() {
  const router = useRouter();
  const { workspaceId } = useLocalSearchParams<{ workspaceId: string }>();

  return (
    <AppScreen
      description={`Workspace route: ${workspaceId ?? 'unknown'}`}
      eyebrow="WORKSPACE"
      title="Workspace details"
    >
      <EmptyState
        actionLabel="Go back"
        description="The workspace destination is ready for the shared workspace query in the next feature phase."
        onAction={() => router.back()}
        title="Workspace route ready"
      />
    </AppScreen>
  );
}
