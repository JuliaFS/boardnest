import { Link } from 'react-router';

import type { ProjectSummary } from '../core/graphql';

const statusLabels: Record<ProjectSummary['status'], string> = {
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  ON_HOLD: 'On hold',
  PLANNED: 'Planned',
};

export function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <article className="group rounded-2xl border border-slate-800 bg-slate-900/60 p-5 transition hover:-translate-y-0.5 hover:border-indigo-400/40 hover:bg-slate-900">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <Link
            className="font-semibold text-slate-100 no-underline after:absolute hover:text-indigo-200"
            to={`/projects/${project.id}`}
          >
            {project.name}
          </Link>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
            {project.description || 'No project description yet.'}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-indigo-400/10 px-2.5 py-1 text-xs font-medium text-indigo-200">
          {statusLabels[project.status]}
        </span>
      </div>
      <div className="mt-5 flex items-center justify-between text-xs text-slate-500">
        <span>
          {project.visibility === 'PRIVATE' ? 'Private' : 'Workspace'}
        </span>
        <Link
          className="font-semibold text-indigo-300 no-underline hover:text-indigo-200"
          to={`/projects/${project.id}/board`}
        >
          Open board →
        </Link>
      </div>
    </article>
  );
}
