import { ArrowDownUp, ArrowUpRight, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import {
  MonthlySpendChart,
  RankedBars,
} from "../../components/finance/FinanceCharts";
import UnusualRequests from "../../components/finance/UnusualRequests";
import BudgetProgressBar from "../../components/fintech/BudgetProgressBar";
import AnimatedContent from "../../components/reactbits/AnimatedContent";
import SummaryCards from "../../components/SummaryCards";
import { ErrorBox, PageHeading, Spinner } from "../../components/UI";
import { financeApi } from "../../services/financeApi";
import { STATUS } from "../../utils/constants";
import { formatMoney, today } from "../../utils/formatters";
import { useAsync } from "../../utils/useAsync";

async function loadOverview() {
  const [year, month] = today().split("-").map(Number);
  const [dashboard, summary, budgets, departments] = await Promise.all([
    financeApi.dashboard(),
    financeApi.anomalySummary({ year, month }),
    financeApi.budgets({ year, month }),
    financeApi.departments(),
  ]);
  const usage = await Promise.all(
    budgets.map(async (budget) => ({
      budget,
      usage: await financeApi.budgetUsage(budget),
    })),
  );
  return { dashboard, summary, usage, departments };
}

export default function FinanceDashboard() {
  const { data, loading, error, reload } = useAsync(loadOverview, []);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const { dashboard, summary, usage, departments } = data;
  const name = (id) =>
    departments.find((entry) => entry.id === id)?.name || `Department ${id}`;
  const period = today().slice(0, 7);
  const categories = new Map();
  dashboard.expenses
    .filter(
      (expense) =>
        expense.status === STATUS.APPROVED &&
        expense.expense_date.startsWith(period),
    )
    .forEach((expense) => {
      categories.set(
        expense.category.name,
        (categories.get(expense.category.name) || 0) + Number(expense.amount),
      );
    });
  const categoryRows = [...categories.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, amount]) => ({ key: label, label, amount }));
  const departmentRows = dashboard.by_department.map((entry, index) => ({
    key: entry.department_id,
    label: entry.department_name,
    amount: Number(entry.total),
    highlight: index === 0,
  }));
  const employeeRows = dashboard.top_employees.map((entry) => ({
    key: entry.user_id,
    label: entry.full_name,
    amount: Number(entry.total),
  }));
  const pendingCount = dashboard.expenses.filter(
    (expense) => expense.status === STATUS.PENDING_MANAGER,
  ).length;
  return (
    <div className="dashboard-bento">
      <PageHeading
        eyebrow="FINANCE OVERVIEW"
        title="The whole company, at a glance."
        description="Spend, budgets, and unusual requests across every department."
        action={
          <button className="btn-secondary" onClick={reload}>
            <ArrowDownUp size={15} />
            Refresh
          </button>
        }
      />
      <div className="bento-grid">
        <AnimatedContent
          className="min-w-0 lg:col-span-7"
          distance={12}
          duration={0.4}
        >
          <SummaryCards expenses={dashboard.expenses} title="Company spend" />
        </AnimatedContent>
        <AnimatedContent
          className="min-w-0 lg:col-span-5"
          delay={0.12}
          distance={12}
          duration={0.4}
        >
          <section className="card bento-panel h-full">
            <h2 className="bento-title mb-1">Spend by department</h2>
            <p className="mb-4 text-[11px] text-zinc-500">
              Approved · All time
            </p>
            <RankedBars rows={departmentRows} />
          </section>
        </AnimatedContent>
        <AnimatedContent
          className="min-w-0 lg:col-span-12"
          delay={0.08}
          distance={12}
          duration={0.4}
        >
          <UnusualRequests summary={summary} />
        </AnimatedContent>
        <AnimatedContent
          className="min-w-0 lg:col-span-7"
          delay={0.1}
          distance={12}
          duration={0.4}
        >
          <section className="card bento-panel h-full">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="bento-title">Monthly spend</h2>
                <p className="mt-1.5 text-[11px] text-zinc-500">
                  Approved expenses · Last 6 months
                </p>
              </div>
              <p className="text-lg font-semibold tracking-tight tabular-nums text-zinc-900">
                {formatMoney(dashboard.approved_total)}
              </p>
            </div>
            <MonthlySpendChart monthly={dashboard.monthly} />
            <div className="dashboard-budget mt-5 border-t border-zinc-100 pt-4">
              <BudgetProgressBar
                spent={dashboard.spent_this_month}
                budget={Number(dashboard.total_budget) || null}
                label="Company budget · this month"
              />
            </div>
            <p className="mt-4 text-[11px] text-zinc-500">
              <span className="tabular-nums">{pendingCount}</span> requests (
              <span className="tabular-nums">
                {formatMoney(dashboard.pending_total)}
              </span>
              ) are waiting for their department manager.
            </p>
          </section>
        </AnimatedContent>
        <AnimatedContent
          className="min-w-0 lg:col-span-5"
          delay={0.04}
          distance={12}
          duration={0.4}
        >
          <section
            className="card bento-panel h-full"
            aria-label="Budgets this month"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <h2 className="bento-title">Budgets this month</h2>
                <p className="mt-1.5 text-[11px] text-zinc-500">
                  Approved spend against each department’s monthly budget
                </p>
              </div>
              <Link
                to="/finance/budgets"
                className="category-view-button"
                aria-label="Manage budgets"
                title="Manage budgets"
              >
                <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="space-y-4">
              {[...usage]
                .sort((a, b) => b.usage.percent - a.usage.percent)
                .map(({ budget, usage: item }) => (
                  <BudgetProgressBar
                    key={budget.id}
                    spent={item.spent}
                    budget={item.budget}
                    label={name(budget.department_id)}
                  />
                ))}
              {!usage.length && (
                <p className="py-5 text-sm text-zinc-500">
                  No budgets set for this month.{" "}
                  <Link to="/finance/budgets" className="text-link">
                    Add one
                  </Link>
                </p>
              )}
            </div>
          </section>
        </AnimatedContent>
        <AnimatedContent
          className="min-w-0 lg:col-span-6"
          delay={0.14}
          distance={12}
          duration={0.4}
        >
          <section className="card bento-panel h-full">
            <h2 className="bento-title mb-1">Spend by category</h2>
            <p className="mb-4 text-[11px] text-zinc-500">
              Approved · This month
            </p>
            <RankedBars
              rows={categoryRows}
              emptyText="No approved spend this month yet."
            />
          </section>
        </AnimatedContent>
        <AnimatedContent
          className="min-w-0 lg:col-span-6"
          delay={0.16}
          distance={12}
          duration={0.4}
        >
          <section className="card bento-panel flex h-full flex-col">
            <h2 className="bento-title mb-1">Top spenders</h2>
            <p className="mb-4 text-[11px] text-zinc-500">
              Approved · All time
            </p>
            <RankedBars rows={employeeRows} />
            <Link
              to="/finance/forecast"
              className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-4 text-[11px] font-medium text-zinc-600"
            >
              <span className="inline-flex items-center gap-2">
                <TrendingUp size={14} />
                See the 4-week forecast
              </span>
              <ArrowUpRight size={14} />
            </Link>
          </section>
        </AnimatedContent>
      </div>
    </div>
  );
}
