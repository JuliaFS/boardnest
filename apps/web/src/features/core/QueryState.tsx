interface QueryErrorProps {
  message?: string;
  onRetry?: () => void;
}

export function PageSkeleton() {
  return (
    <div className="grid gap-4" aria-label="Loading content" role="status">
      <span className="sr-only">Loading…</span>
      {[0, 1, 2].map((item) => (
        <div
          className="h-28 animate-pulse rounded-2xl border border-slate-800 bg-slate-900/70"
          key={item}
        />
      ))}
    </div>
  );
}

export function QueryError({
  message = 'We could not load this information.',
  onRetry,
}: QueryErrorProps) {
  return (
    <div
      className="rounded-2xl border border-rose-900/70 bg-rose-950/30 p-6"
      role="alert"
    >
      <h2 className="font-semibold text-rose-200">Something went wrong</h2>
      <p className="mt-2 text-sm text-rose-300/80">{message}</p>
      {onRetry ? (
        <button
          className="mt-4 rounded-lg bg-rose-200 px-3 py-2 text-sm font-semibold text-rose-950"
          onClick={onRetry}
          type="button"
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 px-6 py-12 text-center">
      <div className="mx-auto grid size-11 place-items-center rounded-xl bg-indigo-400/10 text-indigo-300">
        +
      </div>
      <h2 className="mt-4 font-semibold text-slate-100">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-400">
        {description}
      </p>
    </div>
  );
}
