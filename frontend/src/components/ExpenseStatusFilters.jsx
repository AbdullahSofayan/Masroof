import { STATUS_META } from '../utils/constants';

export default function ExpenseStatusFilters({ value, onChange, expenses }) {
  const filters = [['', 'All'], ...Object.entries(STATUS_META).map(([status, meta]) => [status, meta.label])];
  return <div role="group" aria-label="Filter expenses by status" className="flex gap-1.5 overflow-x-auto border-b border-zinc-100 px-5 py-4">
    {filters.map(([status, label]) => <button key={status || 'all'} type="button" aria-label={label} aria-pressed={value === status}
      onClick={() => onChange(status)}
      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-colors duration-150 ${value === status ? 'bg-zinc-900 text-white shadow-xs' : 'text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900'}`}>
      {label}
      {expenses && <span className={`rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${value === status ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500'}`}>{status ? expenses.filter((expense) => expense.status === status).length : expenses.length}</span>}
    </button>)}
  </div>;
}
