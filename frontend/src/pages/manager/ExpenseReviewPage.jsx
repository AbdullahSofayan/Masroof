import { Check, CheckCircle2, LoaderCircle, MessageSquare, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ApprovalTimeline from '../../components/ApprovalTimeline';
import ExpenseDetails from '../../components/ExpenseDetails';
import ReceiptViewer from '../../components/ReceiptViewer';
import RiskAlertBox from '../../components/RiskAlertBox';
import ApprovalProgressBar from '../../components/fintech/ApprovalProgressBar';
import { BackLink, ErrorBox, PageHeading, Spinner } from '../../components/UI';
import { useAuth } from '../../context/AuthContext';
import { useNotice } from '../../context/NoticeContext';
import { api } from '../../services/api';
import { DECISION, NOTE_MAX_LENGTH, STATUS } from '../../utils/constants';
import { useAsync } from '../../utils/useAsync';

export default function ExpenseReviewPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const notify = useNotice();
  const detail = useAsync(() => api.getExpense(id), [id]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [decisionResult, setDecisionResult] = useState(null);
  if (detail.loading && !detail.data) return <Spinner />;
  if (detail.error) return <><BackLink to="/manager/dashboard">Back to department</BackLink><ErrorBox message={detail.error} retry={detail.reload} /></>;
  const expense = decisionResult?.id === Number(id) ? decisionResult : detail.data;
  const pending = expense.status === STATUS.PENDING_MANAGER;
  const own = expense.requester.id === user.id;
  const canDecide = pending && !own && expense.department.id === user.department_id;

  async function decide(decision) {
    if (decision === DECISION.APPROVE && !expense?.attachment_url) return;
    setBusy(decision); setError('');
    try {
      const result = await api.decide(id, decision, note);
      // Keep details mounted so the server-confirmed badge and tracker can transition.
      const updated = result?.id && result?.status ? result : await api.getExpense(id);
      setDecisionResult(updated);
      notify('Decision recorded. The request status has been updated.');
      setNote('');
    } catch (err) { setError(err.message); if (err.status === 409) detail.reload(); }
    finally { setBusy(''); }
  }

  return <>
    <BackLink to="/manager/dashboard">Back to approval queue</BackLink>
    <PageHeading eyebrow={`Expense #${expense.id}`} title="A closer look before the next step." description="Review the details, verify the receipt, and leave a clear decision." />
    <ApprovalProgressBar status={expense.status} approvals={expense.approvals} className="mb-6" />
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,1fr)]">
      <div className="space-y-6"><ExpenseDetails expense={expense} /><ReceiptViewer expense={expense} /></div>
      <div className="space-y-6">
        {expense.ai_analysis && <RiskAlertBox analysis={expense.ai_analysis} />}
        <section className="card p-5 sm:p-6">
          <h2 className="flex items-center gap-2 font-semibold"><CheckCircle2 size={18} className="text-emerald-600" />Your decision</h2>
          <div className="mt-4"><ErrorBox message={error} /></div>
          {canDecide ? <>
            <p className="mb-5 text-sm leading-6 text-slate-500">Approval sends this request to Finance. Add a note when rejecting or asking for changes.</p>
            <label htmlFor="manager-note" className="field-label">Note to employee <span className="font-normal text-slate-400">(required for changes or rejection)</span></label>
            <textarea id="manager-note" className="input min-h-32 resize-y leading-7" dir="auto" placeholder="Share the context your employee needs…" maxLength={NOTE_MAX_LENGTH} value={note} onChange={(event) => setNote(event.target.value)} disabled={!!busy} />
            <p className="mt-2 text-right text-xs tabular-nums text-slate-400">{note.length} / {NOTE_MAX_LENGTH}</p>
            <div className="mt-5 grid gap-3">
              <button className="btn-primary w-full justify-center" disabled={!!busy || !expense?.attachment_url} aria-describedby={!expense?.attachment_url ? 'approval-receipt-required' : undefined} onClick={() => decide(DECISION.APPROVE)}>{busy === DECISION.APPROVE ? <LoaderCircle size={17} className="animate-spin" /> : <Check size={17} />}Approve expense</button>
              {!expense?.attachment_url && <p id="approval-receipt-required" className="text-xs text-slate-500">Receipt attachment required before approval</p>}
              <div className="grid grid-cols-2 gap-3">
                <button className="btn-secondary justify-center text-xs" disabled={!!busy || !note.trim()} onClick={() => decide(DECISION.REQUEST_CHANGES)}>{busy === DECISION.REQUEST_CHANGES ? <LoaderCircle size={15} className="animate-spin" /> : <MessageSquare size={15} />}Request changes</button>
                <button className="btn-danger justify-center text-xs" disabled={!!busy || !note.trim()} onClick={() => decide(DECISION.REJECT)}>{busy === DECISION.REJECT ? <LoaderCircle size={15} className="animate-spin" /> : <X size={15} />}Reject expense</button>
              </div>
            </div>
          </> : <div>
            <p className="text-sm leading-6 text-slate-500">{own && pending ? 'Your own expense must be reviewed by another manager.' : 'This request has moved beyond manager review. Its decision is recorded in the history below.'}</p>
            <Link to="/manager/dashboard" className="btn-secondary mt-5">Return to queue</Link>
          </div>}
        </section>
        <ApprovalTimeline approvals={expense.approvals} createdAt={expense.created_at} requesterName={expense.requester.full_name} />
      </div>
    </div>
  </>;
}
