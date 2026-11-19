import { Check, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { ErrorBox, PageHeading, Spinner } from '../../components/UI';
import { useNotice } from '../../context/NoticeContext';
import { financeApi } from '../../services/financeApi';
import { STATUS } from '../../utils/constants';
import { formatMoney, today } from '../../utils/formatters';
import { useAsync } from '../../utils/useAsync';

function LimitRow({ category, limit, stats, onSaved }) {
  const notify = useNotice();
  const initial = limit?.max_amount ? Number(limit.max_amount).toFixed(2) : '';
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = value !== initial;
  async function save() {
    setBusy(true); setError('');
    try { await financeApi.saveLimit(category.id, value, limit?.id); notify(value ? `${category.name} limit saved.` : `${category.name} limit removed.`); onSaved(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const valid = /^\d+(\.\d{1,2})?$/.test(value) && Number(value) > 0;
  const over = valid ? stats.requests.filter((amount) => amount > Number(value)).length : 0;
  return <tr>
    <td><p className="font-medium text-slate-800" dir="auto">{category.name}</p>{category.name_ar && <p className="mt-1 text-xs text-slate-500" dir="auto">{category.name_ar}</p>}</td>
    <td>
      <div className="relative"><span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-slate-500">SAR</span>
        <input aria-label={`${category.name} maximum per request`} className="input min-h-9 py-1.5 pl-11 text-sm tabular-nums" inputMode="decimal" placeholder="No limit" value={value} disabled={busy} onChange={(event) => setValue(event.target.value.trim())} onKeyDown={(event) => { if (event.key === 'Enter' && dirty) save(); }} />
      </div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </td>
    <td className="text-right tabular-nums text-slate-500">{formatMoney(stats.average)}</td>
    <td className={`text-right tabular-nums ${over ? 'font-medium text-amber-700' : 'text-slate-500'}`}>{valid ? `${over} of ${stats.requests.length}` : '—'}</td>
    <td className="text-right"><button className="btn-secondary min-h-9 px-3 py-1.5 text-xs" disabled={!dirty || busy} onClick={save}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}Save</button></td>
  </tr>;
}

export default function CategoryLimitsPage() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [categories, limits, expenses] = await Promise.all([financeApi.categories(), financeApi.limits(), financeApi.expenses({ status: STATUS.APPROVED })]);
    return { categories, limits, expenses };
  }, []);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const since = `${Number(today().slice(0, 4)) - 1}${today().slice(4)}`;
  const statsFor = (category) => {
    const sameCategory = (expense) => (expense.category.id != null && category.id != null ? expense.category.id === category.id : expense.category.name === category.name);
    const requests = data.expenses.filter((expense) => sameCategory(expense) && expense.expense_date >= since).map((expense) => Number(expense.amount));
    return { requests, average: requests.length ? requests.reduce((a, b) => a + b, 0) / requests.length : 0 };
  };
  return <div className="dashboard-bento">
    <PageHeading eyebrow="CATEGORY LIMITS" title="One limit per category." description="The maximum amount an employee can request in a single expense. Leave it empty for no limit." />
    <section className="card overflow-hidden">
      <div className="card-heading"><div><h2 className="bento-title">Spending limits</h2><p className="mt-1.5 text-[11px] text-zinc-500">A request above its limit gets a policy warning for the department manager.</p></div></div>
      <div className="overflow-x-auto">
        <table className="expense-table relative min-w-[760px] table-fixed">
          <colgroup><col style={{ width: '30%' }} /><col style={{ width: '24%' }} /><col style={{ width: '16%' }} /><col style={{ width: '16%' }} /><col style={{ width: '14%' }} /></colgroup>
          <thead><tr><th>Category</th><th>Max per request</th><th className="text-right">Average claim</th><th className="text-right">Past claims above</th><th><span className="sr-only">Save</span></th></tr></thead>
          <tbody>{data.categories.map((category) => {
            const limit = data.limits.find((entry) => entry.category_id === category.id);
            return <LimitRow key={`${category.id}-${limit?.id ?? 'none'}-${limit?.max_amount ?? ''}`} category={category} limit={limit} stats={statsFor(category)} onSaved={reload} />;
          })}</tbody>
        </table>
      </div>
      <p className="border-t border-zinc-100 px-6 py-4 text-[11px] text-zinc-500">A limit applies to one request at a time, not a daily or monthly total. “Average claim” and “past claims above” use approved expenses from the last 12 months, so you can see how a new limit would have affected real requests.</p>
    </section>
  </div>;
}
