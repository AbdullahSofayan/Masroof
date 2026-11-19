import { formatDate, formatMoney } from "../utils/formatters";
import StatusBadge from "./StatusBadge";
export default function ExpenseDetails({ expense }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Expense <span className="tabular-nums">#{expense.id}</span>
          </p>
          <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">
            {formatMoney(expense.amount)}
          </p>
        </div>
        <StatusBadge status={expense.status} />
      </div>
      <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-5 text-sm">
        <div>
          <dt className="metadata-label">Submitted by</dt>
          <dd dir="auto">{expense.requester.full_name}</dd>
        </div>
        <div>
          <dt className="metadata-label">Department</dt>
          <dd dir="auto">{expense.department.name}</dd>
        </div>
        <div>
          <dt className="metadata-label">Category</dt>
          <dd dir="auto">{expense.category.name}</dd>
        </div>
        <div>
          <dt className="metadata-label">Expense date</dt>
          <dd className="tabular-nums">{formatDate(expense.expense_date)}</dd>
        </div>
        <div className="col-span-2 border-t border-slate-100 pt-4">
          <dt className="metadata-label">Description</dt>
          <dd className="whitespace-pre-wrap break-words leading-7" dir="auto">
            {expense.description}
          </dd>
        </div>
      </dl>
    </section>
  );
}
