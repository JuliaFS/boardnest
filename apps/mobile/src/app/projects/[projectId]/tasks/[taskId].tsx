import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppScreen, EmptyState } from '@/components/ui';

export default function TaskDetailsScreen() {
  const router = useRouter();
  const { projectId, taskId } = useLocalSearchParams<{
    projectId: string;
    taskId: string;
  }>();

  return (
    <AppScreen
      description={`Project ${projectId ?? 'unknown'} · Task ${taskId ?? 'unknown'}`}
      eyebrow="TASK"
      title="Task details"
    >
      <EmptyState
        actionLabel="Go back"
        description="The task destination is ready for task details, comments, and reminders."
        onAction={() => router.back()}
        title="Task route ready"
      />
    </AppScreen>
  );
}
