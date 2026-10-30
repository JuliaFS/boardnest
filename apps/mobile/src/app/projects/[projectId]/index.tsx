import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppScreen, EmptyState } from '@/components/ui';

export default function ProjectDetailsScreen() {
  const router = useRouter();
  const { projectId } = useLocalSearchParams<{ projectId: string }>();

  return (
    <AppScreen
      description={`Project route: ${projectId ?? 'unknown'}`}
      eyebrow="PROJECT"
      title="Project details"
    >
      <EmptyState
        actionLabel="Go back"
        description="The project destination is ready for project details and board data."
        onAction={() => router.back()}
        title="Project route ready"
      />
    </AppScreen>
  );
}
