import { ArrowRight, ArrowUpRight, Plus, ReceiptText } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import ExpenseTable from '../../components/ExpenseTable';
import SummaryCards from '../../components/SummaryCards';
import { ErrorBox, PageHeading, Spinner } from '../../components/UI';
import AnimatedContent from '../../components/reactbits/AnimatedContent';
import CountUp from '../../components/reactbits/CountUp';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { CURRENCY, PAGE_SIZE, STATUS } from '../../utils/constants';
import { useAsync } from '../../utils/useAsync';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data, loading, error, reload } = useAsync(() => api.allExpenses({ view: 'own' }), [user.id]);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const changes = data.filter((entry) => entry.status === STATUS.NEEDS_CHANGES);
  const total = data.reduce((sum, expense) => sum + Number(expense.amount), 0);

  return (
    <>
      <PageHeading eyebrow="Your expenses, at a glance" title="A little clarity for your workday."
        description={<span dir="auto">Welcome back, <bdi>{user.full_name}</bdi>. Here’s where your requests stand.</span>}
        action={
          <Link to="/employee/expenses/new" className="btn-primary"><Plus size={17} />New expense</Link>
        } />
      <AnimatedContent delay={0} distance={12} duration={0.4}>
        <section className="overview-banner mb-7">
          <div className="relative z-10">
            <p className="text-sm text-emerald-100">Total submitted expenses</p>
            <p className="mt-3 whitespace-nowrap text-3xl font-semibold tracking-tight tabular-nums sm:text-4xl">
              {CURRENCY}{' '}<CountUp to={total} from={0} decimals={2} separator="," duration={0.9} trigger="load" className="tabular-nums" />
            </p>
            <p className="mt-3 text-xs text-emerald-100/70"><span className="tabular-nums">{data.length}</span> requests · All time · Saudi Riyal</p>
          </div>
          <div className="relative z-10 hidden max-w-[220px] sm:block">
            <ReceiptText size={28} className="mb-3 text-emerald-200" />
            <p className="text-sm leading-6 text-emerald-50">Every receipt has a place.<br />Every request has a clear next step.</p>
          </div>
        </section>
      </AnimatedContent>
      <AnimatedContent delay={0.06} distance={14} duration={0.4}><SummaryCards expenses={data} /></AnimatedContent>
      {changes.length > 0 && (
        <AnimatedContent delay={0.12} distance={14} duration={0.4}>
          <Link to={`/employee/expenses?status=${STATUS.NEEDS_CHANGES}`}
            className="mb-7 flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-5 py-4 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-sm">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-100 font-semibold tabular-nums text-orange-700">{changes.length}</span>
            <div><p className="text-sm font-semibold text-orange-900">A quick update is needed</p><p className="mt-1 text-xs text-orange-700">Read your manager’s note, make your changes, and resubmit.</p></div>
            <ArrowRight size={18} className="ml-auto shrink-0 text-orange-700" />
          </Link>
        </AnimatedContent>
      )}
      <AnimatedContent delay={0.18} distance={16} duration={0.45}>
        <section className="card overflow-hidden">
          <div className="card-heading">
            <div><h2 className="font-semibold">Recent expenses</h2><p className="mt-1 text-xs text-slate-400">Your latest submissions and their progress.</p></div>
            <Link to="/employee/expenses" className="text-link">View all<ArrowUpRight size={15} /></Link>
          </div>
          <ExpenseTable expenses={data.slice(0, PAGE_SIZE)} onSelect={(id) => navigate(`/employee/expenses?expense=${id}`)} />
        </section>
      </AnimatedContent>
    </>
  );
}
