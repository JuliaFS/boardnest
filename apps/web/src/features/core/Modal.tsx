import { useEffect, type PropsWithChildren } from 'react';

interface ModalProps extends PropsWithChildren {
  description?: string;
  onClose: () => void;
  title: string;
}

export function Modal({ children, description, onClose, title }: ModalProps) {
  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }

    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="presentation"
    >
      <section
        aria-describedby={description ? 'modal-description' : undefined}
        aria-labelledby="modal-title"
        aria-modal="true"
        className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl sm:p-7"
        role="dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white" id="modal-title">
              {title}
            </h2>
            {description ? (
              <p
                className="mt-1 text-sm leading-6 text-slate-400"
                id="modal-description"
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            aria-label="Close dialog"
            className="rounded-lg px-2.5 py-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </section>
    </div>
  );
}
