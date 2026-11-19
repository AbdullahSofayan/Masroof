import { ArrowUpRight, Check, ReceiptText } from "lucide-react";
import { Link } from "react-router-dom";
import { formatDate, formatMoney } from "../utils/formatters";
import CountUp from "./reactbits/CountUp";
import StatusBadge from "./StatusBadge";

export default function DashboardActivity({ expenses, manager = false }) {
  return (
    <section
      className="card bento-panel h-full"
      aria-label={manager ? "Awaiting review" : "Recent activity"}
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <h2 className="bento-title">
          {manager ? "Awaiting review" : "Recent activity"}
        </h2>
        <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium tabular-nums">
          <CountUp
            to={expenses.length}
            decimals={0}
            trigger="load"
            duration={0.7}
          />
        </span>
      </div>
      <p className="mb-4 text-[11px] text-zinc-400">
        {manager
          ? "Requests awaiting review"
          : "Your latest submissions and updates"}
      </p>
      <ul className="divide-y divide-zinc-100">
        {expenses.slice(0, 4).map((expense) => (
          <li key={expense.id}>
            <Link
              to={
                manager
                  ? `/manager/expenses/${expense.id}`
                  : `/employee/expenses?expense=${expense.id}`
              }
              className="activity-link group"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-100 bg-[#F6F6F4] text-zinc-500">
                <ReceiptText size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate text-xs font-medium text-zinc-800"
                  dir="auto"
                >
                  {manager ? expense.requester.full_name : expense.description}
                </p>
                <p className="mt-1 text-[10px] tabular-nums text-zinc-400">
                  EXP-{expense.id} · {formatDate(expense.expense_date)}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-medium tabular-nums">
                  {formatMoney(expense.amount)}
                </p>
                {!manager && (
                  <div className="mt-1">
                    <StatusBadge status={expense.status} />
                  </div>
                )}
              </div>
              <ArrowUpRight
                size={14}
                className="shrink-0 text-zinc-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
      {!expenses.length && (
        <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center text-xs text-zinc-400">
          <Check size={22} />
          {manager
            ? "All caught up. No requests awaiting review."
            : "Your activity will appear here."}
        </div>
      )}
      <Link
        to={
          manager
            ? `/manager/dashboard#department-expenses`
            : "/employee/expenses"
        }
        className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-4 text-[11px] font-medium text-zinc-600"
      >
        {manager ? "Explore department expenses" : "View all expenses"}
        <ArrowUpRight size={14} />
      </Link>
    </section>
  );
}
