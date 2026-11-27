import { ArrowUpRight, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate, formatMoney, initials } from "../utils/formatters";
import AnimatedExpenseRows from "./fintech/AnimatedExpenseRows";
import StatusBadge from "./StatusBadge";
import { EmptyState } from "./UI";

const COLUMN_WIDTHS = ["24%", "16%", "14%", "16%", "16%", "14%"];
const ARROW_CLASS =
  "transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-focus-within:translate-x-0.5 group-focus-within:-translate-y-0.5";

export default function ExpenseTable({
  expenses,
  manager = false,
  onSelect,
  emptyTitle,
  emptyDescription,
}) {
  if (!expenses.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div
      className="table-scroll"
      tabIndex={0}
      role="region"
      aria-label="Expenses table"
    >
      <table className="expense-table ledger-table">
        <colgroup>
          {COLUMN_WIDTHS.map((width) => (
            <col key={width} style={{ width }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col">{manager ? "Employee / expense" : "Expense"}</th>
            <th scope="col">Category</th>
            <th scope="col">Date</th>
            <th scope="col" className="expense-table-number">
              Amount
            </th>
            <th scope="col">Status</th>
            <th scope="col">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <AnimatedExpenseRows expenses={expenses}>
            {(expense) => (
              <>
                <td style={{ width: COLUMN_WIDTHS[0] }}>
                  <div className="flex items-center gap-2.5">
                    <span
                      className={
                        manager ? "avatar size-8 text-xs" : "expense-icon"
                      }
                      aria-hidden="true"
                    >
                      {manager ? (
                        initials(expense.requester.full_name)
                      ) : (
                        <FileText size={18} />
                      )}
                    </span>
                    <div className="min-w-0">
                      {manager && (
                        <p
                          className="mb-1 font-medium text-slate-800"
                          dir="auto"
                        >
                          {expense.requester.full_name}
                        </p>
                      )}
                      <p
                        className="truncate text-sm font-medium text-slate-700"
                        dir="auto"
                        title={expense.description}
                      >
                        {expense.description}
                      </p>
                      <p className="caption mt-0.5">EXP-{expense.id}</p>
                    </div>
                  </div>
                </td>
                <td style={{ width: COLUMN_WIDTHS[1] }}>
                  <span
                    className="block text-zinc-700"
                    dir="auto"
                    title={expense.category.name}
                  >
                    {expense.category.name}
                  </span>
                </td>
                <td
                  style={{ width: COLUMN_WIDTHS[2] }}
                  className="whitespace-nowrap text-zinc-600"
                >
                  {formatDate(expense.expense_date)}
                </td>
                <td
                  style={{ width: COLUMN_WIDTHS[3] }}
                  className="expense-table-number whitespace-nowrap font-semibold text-zinc-900"
                >
                  {formatMoney(expense.amount)}
                </td>
                <td style={{ width: COLUMN_WIDTHS[4] }}>
                  <StatusBadge status={expense.status} />
                </td>
                <td style={{ width: COLUMN_WIDTHS[5] }} className="text-right">
                  {manager ? (
                    <Link
                      className="text-link"
                      to={`/manager/expenses/${expense.id}`}
                    >
                      Review
                      <ArrowUpRight size={14} className={ARROW_CLASS} />
                    </Link>
                  ) : (
                    <button
                      className="text-link"
                      onClick={() => onSelect(expense.id)}
                      aria-label={`View expense ${expense.id}`}
                    >
                      View
                      <ArrowUpRight size={14} className={ARROW_CLASS} />
                    </button>
                  )}
                </td>
              </>
            )}
          </AnimatedExpenseRows>
        </tbody>
      </table>
    </div>
  );
}
