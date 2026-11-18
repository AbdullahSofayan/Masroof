import { ArrowDownUp, ArrowUpRight, Check, Inbox, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MonthlySpendChart, RankedBars } from '../../components/finance/FinanceCharts';
import BudgetProgressBar from '../../components/fintech/BudgetProgressBar';
import AnimatedContent from '../../components/reactbits/AnimatedContent';
import SummaryCards from '../../components/SummaryCards';
import { ErrorBox, PageHeading, Spinner } from '../../components/UI';
import { financeApi } from '../../services/financeApi';
import { STATUS } from '../../utils/constants';
import { formatDate, formatMoney, today } from '../../utils/formatters';
import { useAsync } from '../../utils/useAsync';

async function loadOverview() {
  const [year, month] = today().split('-').map(Number);
  const [dashboard, expenses, queue, budgets, departments] = await Promise.all([
    financeApi.dashboard(), financeApi.expenses(), financeApi.queue(), financeApi.budgets({ year, month }), financeApi.departments(),
  ]);
  const usage = await Promise.all(budgets.filter((budget) => budget.period_type === 'monthly').map(async (budget) => ({ budget, usage: await financeApi.budgetUsage(budget) })));
  return { dashboard, expenses, queue, usage, departments };
}

function QueueCard({ queue }) {
  const waiting = queue.reduce((total, expense) => total + Number(expense.amount), 0);
  return <section className="card bento-panel flex h-full flex-col" aria-label="Payout queue">
    <div className="mb-1 flex items-center justify-between gap-3"><h2 className="bento-title">Payout queue</h2><span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium tabular-nums">{queue.length}</span></div>
    <p className="mb-4 text-[11px] text-zinc-400">Approved by managers · <span className="tabular-nums">{formatMoney(waiting)}</span> waiting · oldest first</p>
    <ul className="divide-y divide-zinc-100">
      {queue.slice(0, 4).map((expense) => <li key={expense.id}>
        <Link to={`/finance/expenses/${expense.id}`} className="activity-link group">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-zinc-100 bg-[#F6F6F4] text-zinc-500"><Inbox size={16} /></span>
          <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-zinc-800" dir="auto">{expense.requester.full_name}</p><p className="mt-1 truncate text-[10px] tabular-nums text-zinc-400" dir="auto">EXP-{expense.id} · {expense.department.name} · {formatDate(expense.expense_date)}</p></div>
          <p className="shrink-0 text-xs font-medium tabular-nums">{formatMoney(expense.amount)}</p>
          <ArrowUpRight size={14} className="shrink-0 text-zinc-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </Link>
      </li>)}
    </ul>
    {!queue.length && <div className="flex min-h-40 flex-col items-center justify-center gap-3 text-center text-xs text-zinc-400"><Check size={22} />All caught up. Nothing is waiting for Finance.</div>}
    <Link to="/finance/queue" className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-4 text-[11px] font-medium text-zinc-600">Open payout queue<ArrowUpRight size={14} /></Link>
  </section>;
}

export default function FinanceDashboard() {
  const { data, loading, error, reload } = useAsync(loadOverview, []);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const { dashboard, expenses, queue, usage, departments } = data;
  const name = (id) => departments.find((entry) => entry.id === id)?.name || `Department ${id}`;
  const totalBudget = Number(dashboard.total_budget);
  const spentThisMonth = totalBudget - Number(dashboard.remaining_budget);
  const period = today().slice(0, 7);
  const categories = new Map();
  expenses.filter((expense) => expense.status === STATUS.APPROVED && expense.expense_date.startsWith(period)).forEach((expense) => {
    categories.set(expense.category.name, (categories.get(expense.category.name) || 0) + Number(expense.amount));
  });
  const categoryRows = [...categories.entries()].sort((a, b) => b[1] - a[1]).map(([label, amount]) => ({ key: label, label, amount }));
  const departmentRows = dashboard.by_department.map((entry, index) => ({ key: entry.department_id, label: entry.department_name, amount: Number(entry.total), highlight: index === 0 }));
  const employeeRows = dashboard.top_employees.map((entry) => ({ key: entry.user_id, label: entry.full_name, amount: Number(entry.total) }));
  return <div className="dashboard-bento">
    <PageHeading eyebrow="FINANCE OVERVIEW" title="The whole company, at a glance." description="Spend, budgets, and what is waiting for Finance." action={<button className="btn-secondary" onClick={reload}><ArrowDownUp size={15} />Refresh</button>} />
    <div className="bento-grid">
      <AnimatedContent className="min-w-0 lg:col-span-8" distance={12} duration={0.4}><SummaryCards expenses={expenses} title="Company spend" /></AnimatedContent>
      <AnimatedContent className="min-w-0 lg:col-span-4" delay={0.04} distance={12} duration={0.4}><QueueCard queue={queue} /></AnimatedContent>
      <AnimatedContent className="min-w-0 lg:col-span-7" delay={0.08} distance={12} duration={0.4}>
        <section className="card bento-panel h-full">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="bento-title">Monthly spend</h2><p className="mt-1.5 text-[11px] text-zinc-400">Approved expenses · Last 6 months</p></div><p className="text-lg font-semibold tracking-tight tabular-nums text-zinc-900">{formatMoney(dashboard.approved_total)}</p></div>
          <MonthlySpendChart monthly={dashboard.monthly} />
          <div className="dashboard-budget mt-5 border-t border-zinc-100 pt-4"><BudgetProgressBar spent={spentThisMonth} budget={totalBudget || null} label="Company budget · this month" /></div>
        </section>
      </AnimatedContent>
      <AnimatedContent className="min-w-0 lg:col-span-5" delay={0.12} distance={12} duration={0.4}>
        <section className="card bento-panel h-full" aria-label="Budgets this month">
          <div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="bento-title">Budgets this month</h2><p className="mt-1.5 text-[11px] text-zinc-400">Approved spend against each department’s budget</p></div><Link to="/finance/budgets" className="category-view-button" aria-label="Manage budgets" title="Manage budgets"><ArrowUpRight size={16} /></Link></div>
          <div className="space-y-4">
            {[...usage].sort((a, b) => b.usage.percent_used - a.usage.percent_used).map(({ budget, usage: item }) => <BudgetProgressBar key={budget.id} spent={item.spent} budget={item.budget_amount} label={name(budget.department_id)} />)}
            {!usage.length && <p className="py-5 text-sm text-zinc-400">No budgets set for this month. <Link to="/finance/budgets" className="text-link">Add one</Link></p>}
          </div>
        </section>
      </AnimatedContent>
      <AnimatedContent className="min-w-0 lg:col-span-4" delay={0.16} distance={12} duration={0.4}>
        <section className="card bento-panel h-full"><h2 className="bento-title mb-1">Spend by department</h2><p className="mb-4 text-[11px] text-zinc-400">Approved · All time</p><RankedBars rows={departmentRows} /></section>
      </AnimatedContent>
      <AnimatedContent className="min-w-0 lg:col-span-4" delay={0.18} distance={12} duration={0.4}>
        <section className="card bento-panel h-full"><h2 className="bento-title mb-1">Spend by category</h2><p className="mb-4 text-[11px] text-zinc-400">Approved · This month</p><RankedBars rows={categoryRows} emptyText="No approved spend this month yet." /></section>
      </AnimatedContent>
      <AnimatedContent className="min-w-0 lg:col-span-4" delay={0.2} distance={12} duration={0.4}>
        <section className="card bento-panel flex h-full flex-col"><h2 className="bento-title mb-1">Top spenders</h2><p className="mb-4 text-[11px] text-zinc-400">Approved · All time</p><RankedBars rows={employeeRows} />
          <Link to="/finance/forecast" className="mt-auto flex items-center justify-between border-t border-zinc-100 pt-4 text-[11px] font-medium text-zinc-600"><span className="inline-flex items-center gap-2"><TrendingUp size={14} />See the 4-week forecast</span><ArrowUpRight size={14} /></Link>
        </section>
      </AnimatedContent>
    </div>
  </div>;
}
