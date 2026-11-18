import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import BudgetProgressBar from '../../components/fintech/BudgetProgressBar';
import { ErrorBox, Modal, PageHeading, Spinner } from '../../components/UI';
import { useNotice } from '../../context/NoticeContext';
import { financeApi } from '../../services/financeApi';
import { formatMoney, today } from '../../utils/formatters';
import { useAsync } from '../../utils/useAsync';

const MONTHS = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, index, 1))));

function BudgetForm({ departments, initial, onSubmit, onClose, editing }) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { await onSubmit(form); } catch (err) { setError(err.message); setBusy(false); }
  }
  return <Modal title={editing ? 'Edit budget amount' : 'Add a budget'} onClose={onClose} busy={busy}>
    <form className="space-y-4" onSubmit={submit}>
      <ErrorBox message={error} />
      <div><label className="field-label" htmlFor="budget-department">Department</label><select id="budget-department" className="input" value={form.department_id} onChange={set('department_id')} disabled={editing}>{departments.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="field-label" htmlFor="budget-period">Period</label><select id="budget-period" className="input" value={form.period_type} onChange={set('period_type')} disabled={editing}><option value="monthly">Monthly</option><option value="annual">Annual</option></select></div>
        <div><label className="field-label" htmlFor="budget-year">Year</label><input id="budget-year" className="input tabular-nums" type="number" min="2000" max="2100" value={form.year} onChange={set('year')} disabled={editing} /></div>
        <div><label className="field-label" htmlFor="budget-month">Month</label><select id="budget-month" className="input" value={form.month} onChange={set('month')} disabled={editing || form.period_type === 'annual'}>{MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select></div>
      </div>
      <div><label className="field-label" htmlFor="budget-amount">Amount (SAR)</label><input id="budget-amount" className="input tabular-nums" inputMode="decimal" placeholder="10000.00" value={form.amount} onChange={set('amount')} autoFocus /></div>
      {editing && <p className="text-xs text-slate-500">Only the amount can change. To move a budget to another department or period, delete it and add a new one.</p>}
      <div className="flex justify-end gap-2 pt-2"><button type="button" className="btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save budget'}</button></div>
    </form>
  </Modal>;
}

export default function BudgetsPage() {
  const notify = useNotice();
  const [currentYear, currentMonth] = today().split('-').map(Number);
  const [period, setPeriod] = useState({ year: currentYear, month: currentMonth });
  const [dialog, setDialog] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const { data, loading, error, reload } = useAsync(async () => {
    const [budgets, departments] = await Promise.all([financeApi.budgets(period), financeApi.departments()]);
    const rows = await Promise.all(budgets.map(async (budget) => ({ budget, usage: await financeApi.budgetUsage(budget) })));
    return { rows, departments };
  }, [period.year, period.month]);
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const { rows, departments } = data;
  const name = (id) => departments.find((entry) => entry.id === id)?.name || `Department ${id}`;
  const monthly = rows.filter((row) => row.budget.period_type === 'monthly');
  const totalBudget = monthly.reduce((sum, row) => sum + Number(row.usage.budget_amount), 0);
  const totalSpent = monthly.reduce((sum, row) => sum + Number(row.usage.spent), 0);
  const missing = departments.filter((entry) => !monthly.some((row) => row.budget.department_id === entry.id));
  const blank = (departmentId) => ({ department_id: String(departmentId ?? departments[0]?.id ?? ''), period_type: 'monthly', year: String(period.year), month: String(period.month), amount: '' });

  async function save(form) {
    if (dialog.budget) { await financeApi.updateBudget(dialog.budget.id, form.amount); notify('Budget updated.'); }
    else { await financeApi.createBudget(form); notify('Budget added.'); }
    setDialog(null); reload();
  }
  async function remove(budget) {
    try { await financeApi.deleteBudget(budget.id); notify('Budget deleted.'); setConfirm(null); reload(); }
    catch (err) { setConfirm({ ...confirm, error: err.message }); }
  }
  const years = [currentYear - 1, currentYear, currentYear + 1];
  return <div className="dashboard-bento">
    <PageHeading eyebrow="BUDGETS" title="Set the limits, watch the spend." description="Each department’s budget against its approved spend for the period." action={<button className="btn-primary" onClick={() => setDialog({ initial: blank() })}><Plus size={16} />Add budget</button>} />
    <section className="card mb-5 overflow-hidden">
      <div className="card-heading">
        <div><h2 className="bento-title">{MONTHS[period.month - 1]} {period.year}</h2><p className="mt-1.5 text-[11px] text-zinc-400"><span className="tabular-nums">{formatMoney(totalSpent)}</span> spent of <span className="tabular-nums">{formatMoney(totalBudget)}</span> budgeted</p></div>
        <div className="flex flex-wrap gap-2">
          <select aria-label="Month" className="input min-h-9 w-auto py-1.5 text-xs" value={period.month} onChange={(event) => setPeriod((current) => ({ ...current, month: Number(event.target.value) }))}>{MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select>
          <select aria-label="Year" className="input min-h-9 w-auto py-1.5 text-xs" value={period.year} onChange={(event) => setPeriod((current) => ({ ...current, year: Number(event.target.value) }))}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="expense-table relative min-w-[860px] table-fixed">
          <colgroup><col style={{ width: '22%' }} /><col style={{ width: '10%' }} /><col style={{ width: '14%' }} /><col style={{ width: '14%' }} /><col style={{ width: '26%' }} /><col style={{ width: '14%' }} /></colgroup>
          <thead><tr><th>Department</th><th>Period</th><th className="text-right">Budget</th><th className="text-right">Remaining</th><th>Usage</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {[...rows].sort((a, b) => b.usage.percent_used - a.usage.percent_used).map(({ budget, usage }) => <tr key={budget.id}>
              <td className="font-medium text-slate-800" dir="auto">{name(budget.department_id)}</td>
              <td className="capitalize text-slate-500">{budget.period_type}</td>
              <td className="text-right font-semibold tabular-nums text-slate-800">{formatMoney(usage.budget_amount)}</td>
              <td className={`text-right tabular-nums ${Number(usage.remaining) < 0 ? 'font-semibold text-rose-600' : 'text-slate-500'}`}>{formatMoney(usage.remaining)}</td>
              <td><BudgetProgressBar spent={usage.spent} budget={usage.budget_amount} label="Spent" /></td>
              <td><div className="flex justify-end gap-1">
                <button className="icon-button" aria-label={`Edit ${name(budget.department_id)} budget`} title="Edit amount" onClick={() => setDialog({ budget, initial: { ...blank(budget.department_id), period_type: budget.period_type, year: String(budget.year), month: String(budget.month ?? 1), amount: Number(budget.amount).toFixed(2) } })}><Pencil size={15} /></button>
                <button className="icon-button" aria-label={`Delete ${name(budget.department_id)} budget`} title="Delete" onClick={() => setConfirm({ budget })}><Trash2 size={15} /></button>
              </div></td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {!rows.length && <p className="px-6 py-10 text-center text-sm text-zinc-400">No budgets for this period yet.</p>}
      {missing.length > 0 && <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 px-6 py-4 text-xs text-zinc-500">No monthly budget:
        {missing.map((entry) => <button key={entry.id} className="category-filter-pill" onClick={() => setDialog({ initial: blank(entry.id) })}><span dir="auto">{entry.name}</span><Plus size={13} /></button>)}
      </div>}
    </section>
    {dialog && <BudgetForm departments={departments} initial={dialog.initial} editing={Boolean(dialog.budget)} onSubmit={save} onClose={() => setDialog(null)} />}
    {confirm && <Modal title="Delete this budget?" onClose={() => setConfirm(null)}>
      <ErrorBox message={confirm.error} />
      <p className="mb-6 text-sm text-slate-600">The {name(confirm.budget.department_id)} budget of <span className="tabular-nums">{formatMoney(confirm.budget.amount)}</span> will be removed. Expenses are not affected.</p>
      <div className="flex justify-end gap-2"><button className="btn-secondary" onClick={() => setConfirm(null)}>Keep budget</button><button className="btn-danger" onClick={() => remove(confirm.budget)}>Delete budget</button></div>
    </Modal>}
  </div>;
}
