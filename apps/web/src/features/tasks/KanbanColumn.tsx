import { useDroppable } from '@dnd-kit/react';

import type { TaskStatusSummary, TaskSummary } from '../core/graphql';
import { TaskCard } from './TaskCard';

export function KanbanColumn({
  disabled,
  onCreateTask,
  status,
  tasks,
}: {
  disabled: boolean;
  onCreateTask: (statusId: string) => void;
  status: TaskStatusSummary;
  tasks: TaskSummary[];
}) {
  const droppable = useDroppable({
    accept: 'task',
    data: { statusId: status.id },
    id: status.id,
    type: 'column',
  });

  return (
    <section
      className={`flex min-h-72 w-[19rem] shrink-0 flex-col rounded-2xl border bg-slate-900/60 p-3 transition sm:w-[21rem] ${
        droppable.isDropTarget ? 'border-indigo-300/70' : 'border-slate-800'
      }`}
      ref={droppable.ref}
    >
      <header className="flex items-center justify-between gap-3 px-1 py-1">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full"
            style={{ backgroundColor: status.color }}
          />
          <h2 className="text-sm font-semibold text-slate-200">
            {status.name}
          </h2>
          <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-500">
            {tasks.length}
          </span>
        </div>
        <button
          aria-label={`Add task to ${status.name}`}
          className="rounded-lg px-2 py-1 text-lg text-slate-400 hover:bg-slate-800 hover:text-white"
          onClick={() => onCreateTask(status.id)}
          type="button"
        >
          +
        </button>
      </header>
      <div className="mt-3 grid gap-2.5">
        {tasks.map((task, index) => (
          <TaskCard
            disabled={disabled}
            index={index}
            key={task.id}
            task={task}
          />
        ))}
        {tasks.length === 0 ? (
          <button
            className="rounded-xl border border-dashed border-slate-700 px-3 py-8 text-xs text-slate-600 hover:border-indigo-400/40 hover:text-slate-400"
            onClick={() => onCreateTask(status.id)}
            type="button"
          >
            Add the first task
          </button>
        ) : null}
      </div>
    </section>
  );
}
