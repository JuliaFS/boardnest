import { useSortable } from '@dnd-kit/react/sortable';
import { Link } from 'react-router';

import type { TaskSummary } from '../core/graphql';

const priorityStyles: Record<TaskSummary['priority'], string> = {
  HIGH: 'bg-orange-400/10 text-orange-200',
  LOW: 'bg-sky-400/10 text-sky-200',
  MEDIUM: 'bg-amber-400/10 text-amber-200',
  NONE: 'bg-slate-700/60 text-slate-400',
  URGENT: 'bg-rose-400/10 text-rose-200',
};

export function TaskCard({
  disabled,
  index,
  task,
}: {
  disabled: boolean;
  index: number;
  task: TaskSummary;
}) {
  const sortable = useSortable({
    accept: 'task',
    data: { taskId: task.id },
    disabled,
    group: task.statusId,
    id: task.id,
    index,
    type: 'task',
  });

  return (
    <article
      className={`rounded-xl border bg-slate-950 p-3.5 shadow-sm transition ${
        sortable.isDragging
          ? 'border-indigo-300 opacity-50'
          : 'border-slate-800 hover:border-slate-700'
      }`}
      ref={sortable.ref}
    >
      <div className="flex items-start gap-2">
        <Link
          className="min-w-0 flex-1 text-sm font-semibold leading-5 text-slate-100 no-underline hover:text-indigo-200"
          to={`/projects/${task.projectId}/tasks/${task.id}`}
        >
          {task.title}
        </Link>
        <span
          aria-label="Drag task"
          className="cursor-grab text-slate-600"
          title="Drag task"
        >
          ⠿
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span
          className={`rounded-full px-2 py-1 text-[0.65rem] font-bold tracking-wide ${priorityStyles[task.priority]}`}
        >
          {task.priority}
        </span>
        {task.dueAt ? (
          <time className="text-xs text-slate-500" dateTime={task.dueAt}>
            {new Intl.DateTimeFormat(undefined, {
              day: 'numeric',
              month: 'short',
            }).format(new Date(task.dueAt))}
          </time>
        ) : null}
      </div>
    </article>
  );
}
