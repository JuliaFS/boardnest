import { FoundationScreen } from '@/components/foundation-screen';

export default function ProjectsScreen() {
  return (
    <FoundationScreen
      eyebrow="PROJECTS"
      title="Project navigation"
      description="Workspace and project data will be connected through the shared Boardnest GraphQL API."
      items={['Workspace list', 'Project details', 'Task and board navigation']}
    />
  );
}
