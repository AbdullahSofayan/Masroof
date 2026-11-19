import { ArrowUpRight, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate, formatMoney, initials } from "../utils/formatters";
import AnimatedExpenseRows from "./fintech/AnimatedExpenseRows";
import StatusBadge from "./StatusBadge";
import { EmptyState } from "./UI";

const COLUMN_WIDTHS = ["26%", "18%", "13%", "16%", "17%", "10%"];
const ARROW_CLASS =
  "transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-focus-within:translate-x-0.5 group-focus-within:-translate-y-0.5";

export default function ExpenseTable({
  expenses,
  manager = false,
  onSelect,
  emptyTitle,
  emptyDescription,
}) {
  return (
    <>
      <div className="overflow-x-auto">
        <table className="expense-table relative min-w-[1040px] table-fixed">
          <colgroup>
            {COLUMN_WIDTHS.map((width) => (
              <col key={width} style={{ width }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th>{manager ? "Employee / expense" : "Expense"}</th>
              <th>Category</th>
              <th>Date</th>
              <th className="text-right">Amount</th>
              <th>Status</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatedExpenseRows expenses={expenses}>
              {(expense) => (
                <>
                  <td style={{ width: COLUMN_WIDTHS[0] }}>
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          manager ? "avatar size-9 text-xs" : "expense-icon"
                        }
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
                        <p className="mt-1 text-xs tabular-nums text-slate-400">
                          EXP-{expense.id}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td style={{ width: COLUMN_WIDTHS[1] }}>
                    <span
                      className="block truncate text-slate-500"
                      dir="auto"
                      title={expense.category.name}
                    >
                      {expense.category.name}
                    </span>
                  </td>
                  <td
                    style={{ width: COLUMN_WIDTHS[2] }}
                    className="whitespace-nowrap tabular-nums text-slate-500"
                  >
                    {formatDate(expense.expense_date)}
                  </td>
                  <td
                    style={{ width: COLUMN_WIDTHS[3] }}
                    className="whitespace-nowrap text-right font-semibold tabular-nums text-slate-800"
                  >
                    {formatMoney(expense.amount)}
                  </td>
                  <td style={{ width: COLUMN_WIDTHS[4] }}>
                    <StatusBadge status={expense.status} />
                  </td>
                  <td style={{ width: COLUMN_WIDTHS[5] }}>
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
      {!expenses.length && (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      )}
    </>
  );
}
