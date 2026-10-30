import { useState } from 'react';
import { useRouter, type Href } from 'expo-router';

import {
  AppButton,
  AppScreen,
  BottomSheetModal,
  EmptyState,
  useFeedback,
} from '@/components/ui';
import { mobileRoutes } from '@/navigation/routes';

export default function ProjectsScreen() {
  const router = useRouter();
  const { showToast } = useFeedback();
  const [showNavigationPreview, setShowNavigationPreview] = useState(false);

  function openRoute(route: Href, message: string) {
    setShowNavigationPreview(false);
    showToast({ message, tone: 'info' });
    router.push(route);
  }

  return (
    <AppScreen
      eyebrow="PROJECTS"
      title="Project navigation"
      description="Workspace and project data will be connected through the shared Boardnest GraphQL API."
    >
      <EmptyState
        actionLabel="Preview navigation"
        description="The route hierarchy is ready. Project data and boards will be connected in the next mobile feature phase."
        onAction={() => setShowNavigationPreview(true)}
        title="No mobile projects loaded"
      />
      <BottomSheetModal
        description="Use these destinations to verify the native route hierarchy."
        onClose={() => setShowNavigationPreview(false)}
        title="Navigation preview"
        visible={showNavigationPreview}
      >
        <AppButton
          label="Open workspace route"
          onPress={() =>
            openRoute(
              mobileRoutes.workspace('workspace-preview'),
              'Workspace route opened.',
            )
          }
          variant="secondary"
        />
        <AppButton
          label="Open project route"
          onPress={() =>
            openRoute(
              mobileRoutes.project('project-preview'),
              'Project route opened.',
            )
          }
          variant="secondary"
        />
        <AppButton
          label="Open task route"
          onPress={() =>
            openRoute(
              mobileRoutes.task('project-preview', 'task-preview'),
              'Task route opened.',
            )
          }
          variant="secondary"
        />
      </BottomSheetModal>
    </AppScreen>
  );
}
