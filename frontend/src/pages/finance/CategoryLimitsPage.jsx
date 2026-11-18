import { Check, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { ErrorBox, PageHeading, Spinner } from '../../components/UI';
import { useNotice } from '../../context/NoticeContext';
import { financeApi } from '../../services/financeApi';
import { STATUS } from '../../utils/constants';
import { formatMoney, today } from '../../utils/formatters';
import { useAsync } from '../../utils/useAsync';

function LimitRow({ category, policy, stats, onSaved }) {
  const notify = useNotice();
  const initial = { is_allowed: policy ? policy.is_allowed : true, max_amount: policy?.max_amount ? Number(policy.max_amount).toFixed(2) : '' };
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dirty = form.is_allowed !== initial.is_allowed || form.max_amount !== initial.max_amount;
  async function save() {
    setBusy(true); setError('');
    try { await financeApi.savePolicy(category.id, form, policy?.id); notify(`${category.name} limit saved.`); onSaved(); }
    catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }
  const over = form.max_amount ? stats.requests.filter((amount) => amount > Number(form.max_amount)).length : 0;
  return <tr>
    <td><p className="font-medium text-slate-800" dir="auto">{category.name}</p>{category.name_ar && <p className="mt-1 text-xs text-slate-400" dir="auto">{category.name_ar}</p>}</td>
    <td>
      <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" className="peer sr-only" checked={form.is_allowed} onChange={(event) => setForm((current) => ({ ...current, is_allowed: event.target.checked }))} disabled={busy} />
        <span aria-hidden="true" className="relative h-5 w-9 rounded-full bg-slate-200 transition-colors after:absolute after:top-0.5 after:left-0.5 after:size-4 after:rounded-full after:bg-white after:shadow-sm after:transition-transform peer-checked:bg-emerald-600 peer-checked:after:translate-x-4 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500/40" />
        {form.is_allowed ? 'Allowed' : 'Not allowed'}
      </label>
    </td>
    <td>
      <div className="relative"><span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-xs text-slate-400">SAR</span>
        <input aria-label={`${category.name} maximum per request`} className="input min-h-9 py-1.5 pl-11 text-sm tabular-nums" inputMode="decimal" placeholder="No limit" value={form.max_amount} disabled={busy || !form.is_allowed} onChange={(event) => setForm((current) => ({ ...current, max_amount: event.target.value.trim() }))} />
      </div>
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </td>
    <td className="text-right tabular-nums text-slate-500">{formatMoney(stats.average)}</td>
    <td className={`text-right tabular-nums ${over ? 'font-medium text-amber-700' : 'text-slate-400'}`}>{form.max_amount ? `${over} of ${stats.requests.length}` : '—'}</td>
    <td className="text-right"><button className="btn-secondary min-h-9 px-3 py-1.5 text-xs" disabled={!dirty || busy} onClick={save}>{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}Save</button></td>
  </tr>;
}

export default function CategoryLimitsPage() {
  const { data, loading, error, reload } = useAsync(async () => {
    const [categories, policies, expenses] = await Promise.all([financeApi.categories(), financeApi.policies(), financeApi.expenses({ status: STATUS.APPROVED })]);
    return { categories, policies, expenses };
  }, []);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const since = `${Number(today().slice(0, 4)) - 1}${today().slice(4)}`;
  const statsFor = (categoryId) => {
    const requests = data.expenses.filter((expense) => expense.category.id === categoryId && expense.expense_date >= since).map((expense) => Number(expense.amount));
    return { requests, average: requests.length ? requests.reduce((a, b) => a + b, 0) / requests.length : 0 };
  };
  return <div className="dashboard-bento">
    <PageHeading eyebrow="CATEGORY LIMITS" title="One rule per category." description="The maximum amount an employee can request in a single expense. Leave the amount empty for no limit." />
    <section className="card overflow-hidden">
      <div className="card-heading"><div><h2 className="bento-title">Spending limits</h2><p className="mt-1.5 text-[11px] text-zinc-400">Requests above a limit are flagged to the manager and to Finance.</p></div></div>
      <div className="overflow-x-auto">
        <table className="expense-table relative min-w-[880px] table-fixed">
          <colgroup><col style={{ width: '26%' }} /><col style={{ width: '16%' }} /><col style={{ width: '20%' }} /><col style={{ width: '14%' }} /><col style={{ width: '14%' }} /><col style={{ width: '10%' }} /></colgroup>
          <thead><tr><th>Category</th><th>Status</th><th>Max per request</th><th className="text-right">Average claim</th><th className="text-right">Past claims above</th><th><span className="sr-only">Save</span></th></tr></thead>
          <tbody>{data.categories.map((category) => {
            const policy = data.policies.find((entry) => entry.category?.id === category.id);
            return <LimitRow key={`${category.id}-${policy?.id ?? 'none'}-${policy?.max_amount ?? ''}-${policy?.is_allowed ?? ''}`} category={category} policy={policy} stats={statsFor(category.id)} onSaved={reload} />;
          })}</tbody>
        </table>
      </div>
      <p className="border-t border-zinc-100 px-6 py-4 text-[11px] text-zinc-400">Average and “past claims above” use approved expenses from the last 12 months, so you can see how a new limit would have affected real requests.</p>
    </section>
  </div>;
}
