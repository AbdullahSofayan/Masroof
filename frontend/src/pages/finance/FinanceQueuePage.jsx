import { ArrowDownUp } from 'lucide-react';
import { useState } from 'react';
import ExpenseTable from '../../components/ExpenseTable';
import { ErrorBox, PageHeading, Pagination, Spinner } from '../../components/UI';
import { financeApi } from '../../services/financeApi';
import { PAGE_SIZE, STATUS } from '../../utils/constants';
import { formatMoney } from '../../utils/formatters';
import { useAsync } from '../../utils/useAsync';

const pill = (active) => `inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-medium transition-colors duration-150 ${active ? 'bg-zinc-900 text-white shadow-xs' : 'text-zinc-500 hover:bg-zinc-200/60 hover:text-zinc-900'}`;

export function DepartmentSelect({ departments, value, onChange }) {
  return <label className="flex items-center gap-2 text-xs text-zinc-500">Department
    <select className="input min-h-9 w-auto py-1.5 text-xs" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">All departments</option>
      {departments.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
    </select>
  </label>;
}

/** Shared list page for the payout queue and the decision history. */
function FinanceLedger({ mode }) {
  const queueMode = mode === 'queue';
  const [status, setStatus] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(async () => {
    const [expenses, departments] = await Promise.all([
      queueMode ? financeApi.queue() : Promise.all([financeApi.expenses({ status: STATUS.APPROVED }), financeApi.expenses({ status: STATUS.REJECTED })]).then(([a, r]) => [...a, ...r].sort((x, y) => y.expense_date.localeCompare(x.expense_date) || y.id - x.id)),
      financeApi.departments(),
    ]);
    return { expenses, departments };
  }, [mode]);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const inDepartment = data.expenses.filter((expense) => !departmentId || expense.department.id === Number(departmentId));
  const filtered = inDepartment.filter((expense) => !status || expense.status === status);
  const activePage = Math.min(page, Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)));
  const total = filtered.reduce((sum, expense) => sum + Number(expense.amount), 0);
  const statuses = queueMode ? [] : [['', 'All'], [STATUS.APPROVED, 'Approved'], [STATUS.REJECTED, 'Rejected']];
  return <div className="dashboard-bento">
    <PageHeading eyebrow={queueMode ? 'PAYOUT QUEUE' : 'HISTORY'}
      title={queueMode ? 'Ready for the final check.' : 'Every finance decision, on record.'}
      description={queueMode ? 'Manager-approved requests waiting for Finance. Oldest first, so nothing waits too long.' : 'Approved and rejected requests across all departments.'}
      action={<button className="btn-secondary" onClick={reload}><ArrowDownUp size={15} />Refresh</button>} />
    <section className="card overflow-hidden">
      <div className="card-heading">
        <div><h2 className="bento-title">{queueMode ? 'Waiting for Finance' : 'Decided requests'}</h2><p className="mt-1.5 text-[11px] text-zinc-400"><span className="tabular-nums">{filtered.length}</span> requests · <span className="tabular-nums">{formatMoney(total)}</span></p></div>
        <DepartmentSelect departments={data.departments} value={departmentId} onChange={(value) => { setDepartmentId(value); setPage(1); }} />
      </div>
      {!queueMode && <div role="group" aria-label="Filter by decision" className="flex gap-1.5 overflow-x-auto border-b border-zinc-100 px-5 py-4">
        {statuses.map(([value, label]) => <button key={label} type="button" aria-pressed={status === value} className={pill(status === value)} onClick={() => { setStatus(value); setPage(1); }}>{label}
          <span className={`rounded-full px-1.5 py-0.5 text-[9px] tabular-nums ${status === value ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-500'}`}>{value ? inDepartment.filter((expense) => expense.status === value).length : inDepartment.length}</span></button>)}
      </div>}
      <ExpenseTable manager reviewPath="/finance/expenses" expenses={filtered.slice((activePage - 1) * PAGE_SIZE, activePage * PAGE_SIZE)}
        emptyTitle={queueMode ? 'Nothing waiting for Finance' : 'No decisions yet'} emptyDescription={queueMode ? 'Manager-approved requests will appear here.' : 'Approved and rejected requests will appear here.'} />
      <Pagination page={activePage} size={PAGE_SIZE} total={filtered.length} onChange={setPage} />
    </section>
  </div>;
}

export default function FinanceQueuePage() { return <FinanceLedger mode="queue" />; }
export function FinanceHistoryPage() { return <FinanceLedger mode="history" />; }
