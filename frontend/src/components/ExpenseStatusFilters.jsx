import { STATUS_META } from "../utils/constants";

export default function ExpenseStatusFilters({ value, onChange, expenses }) {
  const filters = [
    ["", "All"],
    ...Object.entries(STATUS_META).map(([status, meta]) => [
      status,
      meta.label,
    ]),
  ];
  return (
    <div
      role="group"
      aria-label="Filter expenses by status"
      className="flex flex-wrap gap-1.5 border-b border-zinc-100 px-4 py-3 sm:px-5"
    >
      {filters.map(([status, label]) => (
        <button
          key={status || "all"}
          type="button"
          aria-label={label}
          aria-pressed={value === status}
          onClick={() => onChange(status)}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors duration-150 ${value === status ? "bg-emerald-800 text-white" : "text-zinc-700 hover:bg-zinc-100 active:bg-zinc-200"}`}
        >
          {label}
          {expenses && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[11px] ${value === status ? "bg-white/20 text-white" : "bg-zinc-100 text-zinc-700"}`}
            >
              {status
                ? expenses.filter((expense) => expense.status === status).length
                : expenses.length}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
