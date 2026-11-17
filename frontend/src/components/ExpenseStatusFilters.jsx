import { STATUS_META } from '../utils/constants';

export default function ExpenseStatusFilters({ value, onChange }) {
  const filters = [['', 'All'], ...Object.entries(STATUS_META).map(([status, meta]) => [status, meta.label])];
  return <div role="group" aria-label="Filter expenses by status" className="flex gap-1 overflow-x-auto border-b border-slate-100 px-4 py-3">
    {filters.map(([status, label]) => <button key={status || 'all'} type="button" aria-pressed={value === status}
      onClick={() => onChange(status)}
      className={`shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-150 ${value === status ? 'bg-emerald-50 text-emerald-700' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}>
      {label}
    </button>)}
  </div>;
}
