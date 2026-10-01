import { useQuery } from '@apollo/client/react';
import { useState } from 'react';

import { useAuth } from '../auth/AuthProvider';
import {
  PROJECTS_QUERY,
  WORKSPACES_QUERY,
  type ProjectsData,
  type WorkspacesData,
} from '../core/graphql';
import { PageHeader } from '../core/PageHeader';
import { EmptyState, PageSkeleton, QueryError } from '../core/QueryState';
import { Modal } from '../core/Modal';
import { primaryButtonClassName } from '../core/form-styles';
import { ProjectCard } from './ProjectCard';
import { ProjectForm } from './ProjectForm';
import { WorkspaceForm } from './WorkspaceForm';

export function ProjectsPage() {
  const { user } = useAuth();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [showWorkspaceLimit, setShowWorkspaceLimit] = useState(false);
  const [openForm, setOpenForm] = useState<'project' | 'workspace' | null>(
    null,
  );
  const workspaces = useQuery<WorkspacesData>(WORKSPACES_QUERY);
  const workspaceNodes = workspaces.data?.workspaces.nodes ?? [];
  const guestWorkspaceLimitReached = Boolean(
    user?.isAnonymous && workspaceNodes.length >= 1,
  );
  const activeWorkspaceId =
    workspaceNodes.find(({ id }) => id === selectedWorkspaceId)?.id ??
    workspaceNodes[0]?.id ??
    '';
  const projects = useQuery<ProjectsData>(PROJECTS_QUERY, {
    skip: !activeWorkspaceId,
    variables: { workspaceId: activeWorkspaceId },
  });

  const requestWorkspaceCreation = () => {
    if (guestWorkspaceLimitReached) {
      setShowWorkspaceLimit(true);
      return;
    }
    setShowWorkspaceLimit(false);
    setOpenForm('workspace');
  };

  if (workspaces.loading) return <PageSkeleton />;
  if (workspaces.error) {
    return (
      <QueryError
        message={workspaces.error.message}
        onRetry={() => void workspaces.refetch()}
      />
    );
  }

  return (
    <>
      <PageHeader
        actions={
          <div className="flex flex-wrap items-end gap-3">
            {workspaceNodes.length > 0 ? (
              <label className="grid gap-1 text-xs font-semibold text-slate-400">
                Workspace
                <select
                  className="min-w-56 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  onChange={(event) =>
                    setSelectedWorkspaceId(event.target.value)
                  }
                  value={activeWorkspaceId}
                >
                  {workspaceNodes.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <button
              className="rounded-lg border border-slate-700 px-3 py-2.5 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              onClick={requestWorkspaceCreation}
              type="button"
            >
              New workspace
            </button>
            {activeWorkspaceId ? (
              <button
                className={primaryButtonClassName}
                onClick={() => setOpenForm('project')}
                type="button"
              >
                New project
              </button>
            ) : null}
          </div>
        }
        description="Browse the projects that are visible to you in each workspace."
        eyebrow="Portfolio"
        title="Projects"
      />

      {showWorkspaceLimit ? (
        <p
          className="mb-6 rounded-xl border border-amber-800/70 bg-amber-950/30 p-3 text-sm text-amber-200"
          role="alert"
        >
          Guest users can create only one workspace. You can continue using your
          existing workspace.
        </p>
      ) : null}

      {!activeWorkspaceId ? (
        <EmptyState
          actionLabel="Create workspace"
          description="Create a workspace first to start organizing projects."
          onAction={requestWorkspaceCreation}
          title="No workspaces available"
        />
      ) : projects.loading ? (
        <PageSkeleton />
      ) : projects.error ? (
        <QueryError
          message={projects.error.message}
          onRetry={() => void projects.refetch()}
        />
      ) : projects.data?.projects.nodes.length ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {projects.data.projects.nodes.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      ) : (
        <EmptyState
          actionLabel="Create project"
          description="Use New project above to create the first project in this workspace."
          onAction={() => setOpenForm('project')}
          title="No projects here yet"
        />
      )}

      {openForm === 'workspace' && !guestWorkspaceLimitReached ? (
        <Modal
          description="A workspace is the top-level home for members and projects."
          onClose={() => setOpenForm(null)}
          title="Create workspace"
        >
          <WorkspaceForm
            onCancel={() => setOpenForm(null)}
            onCompleted={(workspace) => {
              setSelectedWorkspaceId(workspace.id);
              setOpenForm(null);
            }}
          />
        </Modal>
      ) : null}
      {openForm === 'project' && activeWorkspaceId ? (
        <Modal
          description="Choose who can discover the project and set its initial lifecycle status."
          onClose={() => setOpenForm(null)}
          title="Create project"
        >
          <ProjectForm
            onCancel={() => setOpenForm(null)}
            onCompleted={() => setOpenForm(null)}
            workspaceId={activeWorkspaceId}
          />
        </Modal>
      ) : null}
    </>
  );
}
