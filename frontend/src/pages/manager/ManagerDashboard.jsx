import { ArrowDownUp, Clock3 } from 'lucide-react';
import { useState } from 'react';
import ExpenseTable from '../../components/ExpenseTable';
import ExpenseStatusFilters from '../../components/ExpenseStatusFilters';
import BudgetProgressBar from '../../components/fintech/BudgetProgressBar';
import SpendSparkline from '../../components/fintech/SpendSparkline';
import { DEMO_DEPARTMENT_ALLOCATION } from '../../components/fintech/spendData';
import SummaryCards from '../../components/SummaryCards';
import { ErrorBox, PageHeading, Pagination, Spinner } from '../../components/UI';
import AnimatedContent from '../../components/reactbits/AnimatedContent';
import CountUp from '../../components/reactbits/CountUp';
import SpotlightCard from '../../components/reactbits/SpotlightCard';
import { useAuth } from '../../context/AuthContext';
import { api, USE_MOCK } from '../../services/api';
import { CURRENCY, PAGE_SIZE, STATUS } from '../../utils/constants';
import { useAsync } from '../../utils/useAsync';

export default function ManagerDashboard() {
  const { user } = useAuth();
  const [status, setStatus] = useState(STATUS.PENDING_MANAGER);
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(() => api.allExpenses({ view: 'department' }), [user.id]);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const queue = data.filter((entry) => entry.status === STATUS.PENDING_MANAGER);
  const filtered = status ? data.filter((entry) => entry.status === status) : data;
  const approved = data.filter((entry) => entry.status === STATUS.APPROVED).reduce((sum, entry) => sum + Number(entry.amount), 0);

  return (
    <>
      <PageHeading eyebrow="Manager workspace" title="Your team’s expenses. A clearer view."
        description={<span dir="auto">{user.department?.name || `Department ${user.department_id}`} · Review requests and keep your team moving.</span>}
        action={<button className="btn-secondary" onClick={reload}><ArrowDownUp size={16} />Refresh</button>} />
      <AnimatedContent delay={0} distance={12} duration={0.4}>
        <div className="mb-7 grid gap-4 md:grid-cols-[1.4fr_1fr]">
          <SpotlightCard theme="light" spotlightColor="rgba(16, 185, 129, 0.12)" spotlightSize={260} borderGlow={0.5} proximity={64}
            className="card p-6 transition-shadow duration-200 hover:shadow-md sm:p-7">
            <p className="text-sm font-medium text-slate-500">Approved department spend</p>
            <p className="mt-3 whitespace-nowrap text-3xl font-semibold tracking-tight tabular-nums text-emerald-800">
              {CURRENCY}{' '}<CountUp to={approved} from={0} decimals={2} separator="," duration={0.9} trigger="load" className="tabular-nums" />
            </p>
            <p className="mt-3 text-xs text-slate-400">Final approvals only · All time</p><BudgetProgressBar className="mt-5" spent={approved} budget={USE_MOCK ? DEMO_DEPARTMENT_ALLOCATION : null} label={USE_MOCK ? "Demo department allocation" : "Department budget"} /><SpendSparkline className="mt-5 border-t border-slate-100 pt-4" expenses={data} />
          </SpotlightCard>
          <SpotlightCard theme="light" spotlightColor="rgba(16, 185, 129, 0.12)" spotlightSize={260} borderGlow={0.5} proximity={64}
            className="card flex items-center gap-5 p-6 transition-shadow duration-200 hover:shadow-md">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"><Clock3 size={25} /></div>
            <div>
              <p className="text-3xl font-semibold tabular-nums"><CountUp to={queue.length} from={0} decimals={0} duration={0.7} trigger="load" className="tabular-nums" /></p>
              <p className="mt-1 text-sm font-medium">Requests awaiting review</p>
              <p className="mt-2 text-xs text-slate-400">A quick decision makes a difference.</p>
            </div>
          </SpotlightCard>
        </div>
      </AnimatedContent>
      <AnimatedContent delay={0.06} distance={14} duration={0.4}><SummaryCards expenses={data} /></AnimatedContent>
      <AnimatedContent delay={0.18} distance={16} duration={0.45}>
        <section className="card overflow-hidden">
          <div className="card-heading">
            <div><h2 className="font-semibold">Department expenses</h2><p className="mt-1 text-xs text-slate-400">Open a request to inspect its receipt and make a decision.</p></div>
          </div>
          <ExpenseStatusFilters value={status} onChange={(next) => { setStatus(next); setPage(1); }} /><ExpenseTable manager expenses={filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)} emptyTitle={status === STATUS.PENDING_MANAGER ? "No pending requests" : "No matching expenses"} emptyDescription="Choose another status to view department requests." />
          <Pagination page={page} size={PAGE_SIZE} total={filtered.length} onChange={setPage} />
        </section>
      </AnimatedContent>
    </>
  );
}
