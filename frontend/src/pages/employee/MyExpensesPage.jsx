import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import ApprovalTimeline from "../../components/ApprovalTimeline";
import ExpenseDetails from "../../components/ExpenseDetails";
import ExpenseTable from "../../components/ExpenseTable";
import ExpenseStatusFilters from "../../components/ExpenseStatusFilters";
import ApprovalProgressBar from "../../components/fintech/ApprovalProgressBar";
import ReceiptViewer from "../../components/ReceiptViewer";
import {
  ErrorBox,
  Modal,
  PageHeading,
  Pagination,
  Spinner,
} from "../../components/UI";
import { useAuth } from "../../context/AuthContext";
import { useNotice } from "../../context/NoticeContext";
import { api } from "../../services/api";
import {
  EDITABLE_STATUSES,
  PAGE_SIZE,
  STATUS_META,
} from "../../utils/constants";
import { useAsync } from "../../utils/useAsync";

function ExpenseDrawer({ id, onClose, onChanged }) {
  const { user } = useAuth();
  const notify = useNotice();
  const detail = useAsync(() => api.getExpense(id), [id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const expense = detail.data;
  async function mutate() {
    setBusy(true);
    setError("");
    try {
      await api.deleteExpense(id);
      notify("Expense deleted.");
      onChanged("delete");
    } catch (err) {
      setError(err.message);
      if (err.status === 409) detail.reload();
    } finally {
      setBusy(false);
    }
  }
  const editable =
    expense?.requester.id === user.id &&
    EDITABLE_STATUSES.includes(expense.status);
  return (
    <Modal title={`Expense #${id}`} drawer onClose={onClose} busy={busy}>
      {detail.loading && !detail.data ? (
        <Spinner />
      ) : detail.error ? (
        <ErrorBox message={detail.error} retry={detail.reload} />
      ) : (
        <div className="space-y-5">
          <ErrorBox message={error} />
          <ApprovalProgressBar
            status={expense.status}
            approvals={expense.approvals}
          />
          <ExpenseDetails expense={expense} />
          {editable && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="mb-3 text-sm text-slate-600">
                You can update this request while it awaits manager review.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to={`/employee/expenses/${expense.id}/edit`}
                  className={`btn-secondary ${busy ? "pointer-events-none opacity-50" : ""}`}
                >
                  <Pencil size={15} />
                  Edit expense
                </Link>
                <button
                  className="btn-danger"
                  disabled={busy}
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
              {confirmDelete && (
                <div className="mt-4 border-t border-slate-200 pt-4">
                  <p className="mb-3 text-sm font-medium">
                    Delete this expense permanently?
                  </p>
                  <div className="flex gap-2">
                    <button
                      className="btn-danger"
                      disabled={busy}
                      onClick={() => mutate()}
                    >
                      {busy ? "Deleting…" : "Yes, delete expense"}
                    </button>
                    <button
                      className="btn-secondary"
                      disabled={busy}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Keep expense
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          <ApprovalTimeline
            approvals={expense.approvals}
            createdAt={expense.created_at}
            requesterName={expense.requester.full_name}
          />
          <ReceiptViewer expense={expense} />
        </div>
      )}
    </Modal>
  );
}
export default function MyExpensesPage() {
  const [params, setParams] = useSearchParams();
  const { user } = useAuth();
  const rawPage = Number(params.get("page"));
  const requestedPage = Number.isInteger(rawPage) ? Math.max(1, rawPage) : 1;
  const status = Object.hasOwn(STATUS_META, params.get("status"))
    ? params.get("status")
    : "";
  const selected = params.get("expense");
  const { data, loading, error, reload } = useAsync(async () => {
    const options = { size: PAGE_SIZE, status, view: "own" };
    const result = await api.listExpenses({ ...options, page: requestedPage });
    // The API paginates results; use its filtered total before fetching an out-of-range page again.
    const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));
    const activePage = Math.min(requestedPage, totalPages);
    return activePage === requestedPage || result.total === 0
      ? result
      : api.listExpenses({ ...options, page: activePage });
  }, [requestedPage, status, user.id]);
  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  function update(values) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      Object.entries(values).forEach(([key, value]) =>
        value ? next.set(key, value) : next.delete(key),
      );
      return next;
    });
  }
  function changed(action) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.delete("page");
      if (action === "delete") next.delete("expense");
      return next;
    });
    reload();
  }
  return (
    <>
      <PageHeading
        eyebrow="Employee workspace"
        title="My expenses"
        description="Every submission, every update, all in one place."
        action={
          <Link to="/employee/expenses/new" className="btn-primary">
            <Plus size={17} />
            New expense
          </Link>
        }
      />
      <section className="card overflow-hidden" aria-busy={loading}>
        <div className="card-heading">
          <div>
            <h2 className="font-semibold">Expense history</h2>
            <p className="mt-1 text-xs text-slate-400">
              Select a request to see its receipt and approval history.
            </p>
          </div>
        </div>
        <ExpenseStatusFilters
          value={status}
          onChange={(value) => update({ status: value, page: "" })}
        />
        {loading && data && (
          <p role="status" className="sr-only">
            Updating expenses…
          </p>
        )}
        {loading && !data ? (
          <Spinner />
        ) : error ? (
          <div className="p-5">
            <ErrorBox message={error} retry={reload} />
          </div>
        ) : (
          <>
            <ExpenseTable
              expenses={data.items}
              onSelect={(id) => update({ expense: id })}
              emptyTitle={
                status
                  ? "No matching expenses"
                  : "Your first expense starts here"
              }
              emptyDescription={
                status
                  ? "Try another status to find your request."
                  : "Submit a work expense with its receipt to get started."
              }
            />
            <Pagination
              page={page}
              size={PAGE_SIZE}
              total={data.total}
              onChange={(value) => update({ page: value })}
            />
          </>
        )}
      </section>
      {selected && (
        <ExpenseDrawer
          key={selected}
          id={selected}
          onClose={() => update({ expense: "" })}
          onChanged={changed}
        />
      )}
    </>
  );
}
