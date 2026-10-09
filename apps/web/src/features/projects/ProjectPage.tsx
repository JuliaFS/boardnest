import { useMutation, useQuery } from '@apollo/client/react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import {
  DELETE_PROJECT_MUTATION,
  PROJECTS_QUERY,
  PROJECT_QUERY,
  type ProjectData,
} from '../core/graphql';
import { Modal } from '../core/Modal';
import { PageHeader } from '../core/PageHeader';
import { EmptyState, PageSkeleton, QueryError } from '../core/QueryState';
import { secondaryButtonClassName } from '../core/form-styles';
import { ProjectForm } from './ProjectForm';
import { ProjectMembersSection } from './ProjectMembersSection';

export function ProjectPage() {
  const { projectId = '' } = useParams();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteProject, deletion] = useMutation(DELETE_PROJECT_MUTATION);
  const result = useQuery<ProjectData>(PROJECT_QUERY, {
    skip: !projectId,
    variables: { id: projectId },
  });

  if (result.loading) return <PageSkeleton />;
  if (result.error) return <QueryError message={result.error.message} />;
  if (!result.data?.project) {
    return (
      <EmptyState
        description="It may have been removed, or you may not have access to it."
        title="Project not found"
      />
    );
  }

  const project = result.data.project;

  return (
    <>
      <PageHeader
        actions={
          <div className="flex flex-wrap gap-3">
            <button
              className={secondaryButtonClassName}
              onClick={() => setEditing(true)}
              type="button"
            >
              Edit project
            </button>
            <Link
              className="rounded-lg bg-indigo-300 px-4 py-2.5 text-sm font-bold text-slate-950 no-underline hover:bg-indigo-200"
              to={`/projects/${project.id}/board`}
            >
              Open board
            </Link>
          </div>
        }
        description={project.description || 'No project description yet.'}
        eyebrow="Project"
        title={project.name}
      />
      <dl className="grid gap-4 sm:grid-cols-3">
        <ProjectFact label="Status" value={project.status.replace('_', ' ')} />
        <ProjectFact label="Visibility" value={project.visibility} />
        <ProjectFact label="Due date" value={project.dueDate ?? 'Not set'} />
      </dl>
      <ProjectMembersSection
        projectId={project.id}
        visibility={project.visibility}
        workspaceId={project.workspaceId}
      />
      <section className="mt-10 rounded-2xl border border-rose-950 bg-rose-950/10 p-5">
        <h2 className="font-semibold text-rose-200">Danger zone</h2>
        <p className="mt-1 text-sm text-slate-400">
          Deleting a project also removes its statuses, tasks, and related
          records.
        </p>
        <button
          className="mt-4 rounded-lg border border-rose-800 px-3 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-950/50"
          onClick={() => setConfirmingDelete(true)}
          type="button"
        >
          Delete project
        </button>
      </section>

      {editing ? (
        <Modal onClose={() => setEditing(false)} title="Edit project">
          <ProjectForm
            onCancel={() => setEditing(false)}
            onCompleted={() => setEditing(false)}
            project={project}
            workspaceId={project.workspaceId}
          />
        </Modal>
      ) : null}
      {confirmingDelete ? (
        <Modal
          description={`This will permanently delete “${project.name}”.`}
          onClose={() => setConfirmingDelete(false)}
          title="Delete project?"
        >
          {deletion.error ? (
            <p className="mb-4 text-sm text-rose-300" role="alert">
              {deletion.error.message}
            </p>
          ) : null}
          <div className="flex justify-end gap-3">
            <button
              className={secondaryButtonClassName}
              onClick={() => setConfirmingDelete(false)}
              type="button"
            >
              Cancel
            </button>
            <button
              className="rounded-lg bg-rose-400 px-4 py-2.5 text-sm font-bold text-rose-950 disabled:opacity-60"
              disabled={deletion.loading}
              onClick={() => {
                void deleteProject({
                  refetchQueries: [
                    {
                      query: PROJECTS_QUERY,
                      variables: { workspaceId: project.workspaceId },
                    },
                  ],
                  variables: { id: project.id },
                })
                  .then(() => navigate('/projects', { replace: true }))
                  .catch(() => undefined);
              }}
              type="button"
            >
              {deletion.loading ? 'Deleting…' : 'Delete permanently'}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}

function ProjectFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 capitalize text-slate-100">{value.toLowerCase()}</dd>
    </div>
  );
}
