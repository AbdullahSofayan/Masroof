import { ArrowUpRight } from "lucide-react";
import { STATUS } from "../utils/constants";
import { formatMoney } from "../utils/formatters";

export const expenseCategoryKey = (expense) =>
  expense.category?.id ?? expense.category?.name ?? "Uncategorized";

export default function CategoryExposureCard({
  expenses = [],
  reviewExpenses = expenses,
  selectedCategory,
  onCategorySelect,
  onViewExpenses,
}) {
  const categories = new Map();
  let total = 0;
  expenses.forEach((expense) => {
    const amount = Math.max(0, Number(expense.amount) || 0);
    const key = expenseCategoryKey(expense);
    const current = categories.get(key) || {
      name: expense.category?.name || "Uncategorized",
      amount: 0,
    };
    current.amount += amount;
    total += amount;
    categories.set(key, current);
  });
  const rows = [...categories.entries()].sort(
    (a, b) => b[1].amount - a[1].amount,
  );
  const awaiting = reviewExpenses.filter(
    (expense) => expense.status === STATUS.PENDING_MANAGER,
  ).length;
  const receipts = expenses.filter((expense) => expense.attachment_url).length;
  return (
    <section className="card bento-panel h-full" aria-label="Spend by Category">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="bento-title">Spend by Category</h2>
        <button
          type="button"
          className="category-view-button"
          aria-label="View expenses by category"
          title="View expenses by category"
          onClick={onViewExpenses}
        >
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="space-y-1">
        {rows.map(([key, category]) => {
          const percent = total > 0 ? (category.amount / total) * 100 : 0;
          const select = () => onCategorySelect?.({ key, name: category.name });
          return (
            <div
              key={key}
              className="category-row"
              role="button"
              tabIndex={0}
              aria-label={`Filter by ${category.name}`}
              aria-pressed={selectedCategory === key}
              onClick={select}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  select();
                }
              }}
            >
              <div className="mb-2 flex items-start justify-between gap-3 text-[11px]">
                <span className="min-w-0 text-zinc-600" dir="auto">
                  {category.name}
                </span>
                <span className="shrink-0 text-right font-medium tabular-nums text-zinc-900">
                  {formatMoney(category.amount)}{" "}
                  <span className="ml-1 text-[10px] font-normal text-zinc-400">
                    {Math.round(percent)}%
                  </span>
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-zinc-100"
                aria-hidden="true"
              >
                <div
                  className="h-full rounded-full bg-zinc-900"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          );
        })}
        {!rows.length && (
          <p className="py-5 text-sm text-zinc-400">
            Category insights appear with your first expense.
          </p>
        )}
      </div>
      <dl className="mt-5 space-y-3 border-t border-zinc-100 pt-4 text-[11px]">
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">Average claim</dt>
          <dd className="font-medium tabular-nums">
            {formatMoney(expenses.length ? total / expenses.length : 0)}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">Awaiting review</dt>
          <dd className="font-medium tabular-nums">
            {awaiting} {awaiting === 1 ? "request" : "requests"}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-zinc-500">Receipts attached</dt>
          <dd className="font-medium tabular-nums">
            {receipts} / {expenses.length}
          </dd>
        </div>
      </dl>
    </section>
  );
}
