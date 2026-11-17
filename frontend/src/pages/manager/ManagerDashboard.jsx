import { ArrowDownUp, X } from 'lucide-react';
import { useRef, useState } from 'react';
import CategoryExposureCard, { expenseCategoryKey } from '../../components/CategoryExposureCard';
import DashboardActivity from '../../components/DashboardActivity';
import ExpenseTable from '../../components/ExpenseTable';
import ExpenseStatusFilters from '../../components/ExpenseStatusFilters';
import BudgetProgressBar from '../../components/fintech/BudgetProgressBar';
import SpendSparkline from '../../components/fintech/SpendSparkline';
import { DEMO_DEPARTMENT_ALLOCATION } from '../../components/fintech/spendData';
import SummaryCards from '../../components/SummaryCards';
import { ErrorBox, PageHeading, Pagination, Spinner } from '../../components/UI';
import AnimatedContent from '../../components/reactbits/AnimatedContent';
import { useReducedMotion } from '../../components/reactbits/motionSafety';
import { useAuth } from '../../context/AuthContext';
import { api, USE_MOCK } from '../../services/api';
import { PAGE_SIZE, STATUS } from '../../utils/constants';
import { useAsync } from '../../utils/useAsync';

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [status, setStatus] = useState(STATUS.PENDING_MANAGER);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState(null);
  const ledgerRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const { data, loading, error, reload } = useAsync(() => api.allExpenses({ view: 'department' }), [user.id]);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const reviewable = data.filter((entry) => entry.requester?.id !== user.id);
  const spendExpenses = data.filter((entry) => entry.status !== STATUS.REJECTED);
  const queue = reviewable.filter((entry) => entry.status === STATUS.PENDING_MANAGER);
  const categoryExpenses = category ? reviewable.filter((entry) => expenseCategoryKey(entry) === category.key) : reviewable;
  const filtered = status ? categoryExpenses.filter((entry) => entry.status === status) : categoryExpenses;
  const activePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const approved = data.filter((entry) => entry.status === STATUS.APPROVED).reduce((sum, entry) => sum + Number(entry.amount), 0);
  function scrollToLedger() {
    ledgerRef.current?.scrollIntoView?.({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
  }
  function selectCategory(next) {
    setCategory((current) => current?.key === next.key ? null : next);
    setPage(1);
    scrollToLedger();
  }
  function viewExpenses() {
    setStatus('');
    setCategory(null);
    setPage(1);
    scrollToLedger();
  }
  return <div className="dashboard-bento">
    <PageHeading eyebrow="MANAGER OVERVIEW" title="A clear view of your department."
      description={<span dir="auto">{user.department?.name || `Department ${user.department_id}`} · Spend, approvals, and what’s next.</span>}
      action={<button className="btn-secondary" onClick={reload}><ArrowDownUp size={15} />Refresh</button>} />
    <div className="bento-grid">
      <AnimatedContent className="min-w-0 lg:col-span-8" distance={12} duration={0.4}><SummaryCards expenses={data} title="Department spend" /></AnimatedContent>
      <AnimatedContent className="min-w-0 lg:col-span-4" delay={0.04} distance={12} duration={0.4}><CategoryExposureCard expenses={spendExpenses} reviewExpenses={reviewable} selectedCategory={category?.key} onCategorySelect={selectCategory} onViewExpenses={viewExpenses} /></AnimatedContent>
      <AnimatedContent className="min-w-0 lg:col-span-7" delay={0.08} distance={12} duration={0.4}>
        <section className="card bento-panel h-full"><SpendSparkline expenses={data} />
          <div className="dashboard-budget mt-5 border-t border-zinc-100 pt-4"><BudgetProgressBar spent={approved} budget={USE_MOCK ? DEMO_DEPARTMENT_ALLOCATION : null} label={USE_MOCK ? 'Demo department allocation' : 'Department budget'} /><p className="mt-2 text-[10px] text-zinc-400">Final approvals only · All time</p></div>
        </section>
      </AnimatedContent>
      <AnimatedContent className="min-w-0 lg:col-span-5" delay={0.12} distance={12} duration={0.4}><DashboardActivity expenses={queue} manager /></AnimatedContent>
    </div>
    <AnimatedContent delay={0.16} distance={12} duration={0.4}>
      <section ref={ledgerRef} id="department-expenses" className="card mt-5 scroll-mt-24 overflow-hidden">
        <div className="card-heading"><div><h2 className="bento-title">Department expenses</h2><p className="mt-1.5 text-[11px] text-zinc-400">Inspect receipts, review requests, and keep things moving.</p></div><span className="rounded-full border border-zinc-200 px-3 py-1 text-[10px] text-zinc-500"><span className="tabular-nums">{categoryExpenses.length}</span> requests</span></div>
        {category && <div className="category-filter-bar"><button type="button" className="category-filter-pill" aria-label="Clear category filter" onClick={() => { setCategory(null); setPage(1); }}><span>Category: <bdi dir="auto">{category.name}</bdi></span><X size={13} aria-hidden="true" /></button></div>}
        <ExpenseStatusFilters value={status} expenses={categoryExpenses} onChange={(next) => { setStatus(next); setPage(1); }} />
        <ExpenseTable manager expenses={filtered.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE)} emptyTitle={status === STATUS.PENDING_MANAGER ? 'No pending requests' : 'No matching expenses'} emptyDescription="Choose another status to view department requests." />
        <Pagination page={activePage} size={PAGE_SIZE} total={filtered.length} onChange={setPage} />
      </section>
    </AnimatedContent>
  </div>;
}
