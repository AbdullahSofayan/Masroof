import {
  AlertCircle,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  ReceiptText,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
export function Spinner({ label = "Loading your workspace…" }) {
  return (
    <div
      role="status"
      className="flex min-h-48 items-center justify-center gap-3 text-sm text-slate-500"
    >
      <LoaderCircle size={20} className="animate-spin text-emerald-600" />
      {label}
    </div>
  );
}
export function ErrorBox({ message, retry }) {
  return (
    message && (
      <div
        role="alert"
        className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
      >
        <AlertCircle size={19} className="shrink-0" />
        <div className="min-w-0 flex-1" dir="auto">
          {message}
        </div>
        {retry && (
          <button className="shrink-0 font-semibold underline" onClick={retry}>
            Try again
          </button>
        )}
      </div>
    )
  );
}
export function EmptyState({
  title = "No expenses yet",
  description = "Your expense requests will appear here.",
  action,
}) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        <ReceiptText size={24} />
      </div>
      <h3 className="font-semibold text-slate-900">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function PageHeading({ eyebrow, title, description, action }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && (
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">
            {eyebrow}
          </p>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
export function BackLink({ to, children }) {
  return (
    <Link
      to={to}
      className="mb-5 inline-flex items-center gap-2 text-sm text-slate-500 hover:text-emerald-700"
    >
      <ArrowLeft size={16} />
      {children}
    </Link>
  );
}
export function Pagination({ page, size, total, onChange }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
      <span className="tabular-nums">
        {total
          ? `${(page - 1) * size + 1}–${Math.min(page * size, total)} of ${total} expenses`
          : "0 expenses"}
      </span>
      <div className="flex items-center gap-3">
        <button
          className="icon-button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        <button
          className="icon-button"
          aria-label="Next page"
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  drawer = false,
  busy = false,
}) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const dialog = ref.current;
    const focus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      focus?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={drawer ? "modal drawer" : "modal"}
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) closeRef.current();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) closeRef.current();
      }}
    >
      <div className="modal-body">
        <div className="mb-6 flex items-center justify-between gap-4">
          <h2 id="modal-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button
            className="icon-button"
            disabled={busy}
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
