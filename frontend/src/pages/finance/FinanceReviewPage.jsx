import { Check, CheckCircle2, LoaderCircle, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ApprovalTimeline from '../../components/ApprovalTimeline';
import ExpenseDetails from '../../components/ExpenseDetails';
import BudgetProgressBar from '../../components/fintech/BudgetProgressBar';
import ApprovalProgressBar from '../../components/fintech/ApprovalProgressBar';
import ReceiptViewer from '../../components/ReceiptViewer';
import RiskAlertBox from '../../components/RiskAlertBox';
import { BackLink, ErrorBox, PageHeading, Spinner } from '../../components/UI';
import { useNotice } from '../../context/NoticeContext';
import { financeApi } from '../../services/financeApi';
import { DECISION, NOTE_MAX_LENGTH, STATUS } from '../../utils/constants';
import { formatMoney } from '../../utils/formatters';
import { useAsync } from '../../utils/useAsync';

async function loadReview(id) {
  const expense = await financeApi.getExpense(id);
  const [year, month] = expense.expense_date.split('-').map(Number);
  const [budgets, policies] = await Promise.all([financeApi.budgets({ year, month }), financeApi.policies()]);
  const budget = budgets.find((entry) => entry.department_id === expense.department.id && entry.period_type === 'monthly');
  const usage = budget ? await financeApi.budgetUsage(budget) : null;
  const policy = policies.find((entry) => entry.category?.id === expense.category.id) || null;
  return { expense, usage, policy };
}

/** Budget and limit checks Finance should see before paying (same rules as backend/finance). */
function PolicyChecks({ expense, usage, policy }) {
  const amount = Number(expense.amount);
  const limit = policy?.max_amount ? Number(policy.max_amount) : null;
  const overLimit = limit !== null && amount > limit;
  const blocked = policy && !policy.is_allowed;
  const pending = expense.status === STATUS.PENDING_FINANCE;
  const counted = pending || expense.status === STATUS.APPROVED;
  const spentAfter = usage ? Number(usage.spent) + (pending ? amount : 0) : null;
  const overBudget = usage && spentAfter > Number(usage.budget_amount);
  return <section className="card p-5 sm:p-6" aria-label="Budget and limit checks">
    <h2 className="mb-4 font-semibold text-slate-900">Budget and limit checks</h2>
    <ul className="mb-5 space-y-2 text-sm">
      <li className={`rounded-lg px-3 py-2 ${blocked || overLimit ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
        {blocked ? `${expense.category.name} is not an allowed category.` : limit === null ? `No spending limit is set for ${expense.category.name}.` : overLimit ? `Above the ${expense.category.name} limit of ${formatMoney(limit)}.` : `Within the ${expense.category.name} limit of ${formatMoney(limit)}.`}
      </li>
      <li className={`rounded-lg px-3 py-2 ${!usage || !counted ? 'bg-slate-50 text-slate-600' : overBudget ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
        {!usage ? 'No monthly budget is set for this department.' : !counted ? `${expense.department.name} budget: this request is not counted (${expense.status.replace('_', ' ')}).` : overBudget ? `${pending ? 'Approving this takes' : 'Approved spend has taken'} ${expense.department.name} over its monthly budget.` : `${expense.department.name} stays within its monthly budget.`}
      </li>
    </ul>
    {usage && <BudgetProgressBar spent={spentAfter} budget={usage.budget_amount} label={pending ? 'Department budget after approval' : 'Department budget this month'} />}
  </section>;
}

export default function FinanceReviewPage() {
  const { id } = useParams();
  const notify = useNotice();
  const detail = useAsync(() => loadReview(id), [id]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  if (detail.loading && !detail.data) return <Spinner />;
  if (detail.error) return <><BackLink to="/finance/queue">Back to payout queue</BackLink><ErrorBox message={detail.error} retry={detail.reload} /></>;
  const { expense } = detail.data;
  const pending = expense.status === STATUS.PENDING_FINANCE;
  const hasReceipt = Boolean(expense.attachment_url);

  async function decide(decision) {
    if (decision === DECISION.APPROVE && !hasReceipt) return;
    setBusy(decision); setError('');
    try {
      await financeApi.decide(expense.id, decision, note);
      notify(decision === DECISION.APPROVE ? 'Approved. The employee will be reimbursed.' : 'Rejected. The employee has been notified.');
      setNote(''); detail.reload();
    } catch (err) { setError(err.message); if (err.status === 409) detail.reload(); }
    finally { setBusy(''); }
  }

  return <>
    <BackLink to={pending ? '/finance/queue' : '/finance/history'}>{pending ? 'Back to payout queue' : 'Back to history'}</BackLink>
    <PageHeading eyebrow={`Expense #${expense.id}`} title="The final check before payment." description="Verify the receipt, the budget, and the manager’s decision." />
    <ApprovalProgressBar status={expense.status} approvals={expense.approvals} className="mb-6" />
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,1fr)]">
      <div className="space-y-6"><ExpenseDetails expense={expense} /><ReceiptViewer expense={expense} /></div>
      <div className="space-y-6">
        {expense.ai_analysis && <RiskAlertBox analysis={expense.ai_analysis} />}
        <PolicyChecks {...detail.data} />
        <section className="card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} className="text-emerald-600" />Finance decision</h2>
          <div className="mt-4"><ErrorBox message={error} /></div>
          {pending ? <>
            <p className="mb-5 text-sm leading-6 text-slate-500">Approval is final and releases the reimbursement. A note is required to reject.</p>
            <label htmlFor="finance-note" className="field-label">Note to employee <span className="font-normal text-slate-400">(required to reject)</span></label>
            <textarea id="finance-note" className="input min-h-28 resize-y leading-7" dir="auto" placeholder="Explain what was checked or why it is rejected…" maxLength={NOTE_MAX_LENGTH} value={note} onChange={(event) => setNote(event.target.value)} disabled={!!busy} />
            <p className="mt-2 text-right text-xs tabular-nums text-slate-400">{note.length} / {NOTE_MAX_LENGTH}</p>
            <div className="mt-5 grid gap-3">
              <button className="btn-primary w-full justify-center" disabled={!!busy || !hasReceipt} aria-describedby={!hasReceipt ? 'finance-receipt-required' : undefined} onClick={() => decide(DECISION.APPROVE)}>{busy === DECISION.APPROVE ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />}Approve for payment</button>
              {!hasReceipt && <p id="finance-receipt-required" className="text-xs text-slate-500">A receipt is required before approval.</p>}
              <button className="btn-danger justify-center text-xs" disabled={!!busy || !note.trim()} onClick={() => decide(DECISION.REJECT)}>{busy === DECISION.REJECT ? <LoaderCircle size={15} className="animate-spin" /> : <X size={15} />}Reject expense</button>
            </div>
          </> : <div>
            <p className="text-sm leading-6 text-slate-500">{expense.status === STATUS.APPROVED || expense.status === STATUS.REJECTED ? 'This request is closed. The decision is recorded in the history below.' : 'This request has not reached Finance yet.'}</p>
            <Link to="/finance/queue" className="btn-secondary mt-5">Return to queue</Link>
          </div>}
        </section>
        <ApprovalTimeline approvals={expense.approvals} createdAt={expense.created_at} requesterName={expense.requester.full_name} />
      </div>
    </div>
  </>;
}
