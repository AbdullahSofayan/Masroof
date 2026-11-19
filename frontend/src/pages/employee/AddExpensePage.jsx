import {
  Check,
  FileText,
  LoaderCircle,
  Paperclip,
  Send,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BackLink, ErrorBox, PageHeading, Spinner } from "../../components/UI";
import ApprovalProgressBar from "../../components/fintech/ApprovalProgressBar";
import ReceiptScanPreview from "../../components/fintech/ReceiptScanPreview";
import { useAuth } from "../../context/AuthContext";
import { useNotice } from "../../context/NoticeContext";
import { api } from "../../services/api";
import {
  CURRENCY,
  DESCRIPTION_MAX_LENGTH,
  EDITABLE_STATUSES,
  FILE_ACCEPT,
  FILE_SIZE_LABEL,
  validateReceipt,
} from "../../utils/constants";
import { today } from "../../utils/formatters";
import { useAsync } from "../../utils/useAsync";

export default function AddExpensePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const notify = useNotice();
  const initial = useAsync(async () => {
    const [categories, expense] = await Promise.all([
      api.categories(),
      id ? api.getExpense(id) : null,
    ]);
    return { categories, expense };
  }, [id]);
  const [form, setForm] = useState({
    amount: "",
    category_id: "",
    expense_date: today(),
    description: "",
  });
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [savedId, setSavedId] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [receiptGeneration, setReceiptGeneration] = useState(0);
  useEffect(() => {
    const expense = initial.data?.expense;
    setForm(
      expense
        ? {
            amount: expense.amount,
            category_id: String(expense.category.id),
            expense_date: expense.expense_date,
            description: expense.description,
          }
        : {
            amount: "",
            category_id: "",
            expense_date: today(),
            description: "",
          },
    );
    setFile(null);
    setError("");
    setSavedId(null);
  }, [initial.data]);
  if (initial.loading) return <Spinner />;
  if (initial.error)
    return <ErrorBox message={initial.error} retry={initial.reload} />;
  const expense = initial.data.expense;
  if (
    expense &&
    (expense.requester.id !== user.id ||
      !EDITABLE_STATUSES.includes(expense.status))
  )
    return (
      <>
        <BackLink to="/employee/expenses">My expenses</BackLink>
        <ErrorBox message="This request cannot be edited. Only your pending expenses can be changed." />
      </>
    );
  const setField = (event) =>
    setForm((previous) => ({
      ...previous,
      [event.target.name]: event.target.value,
    }));
  function chooseReceipt(chosen) {
    if (busy) return;
    if (!chosen) {
      setFile(null);
      return;
    }
    const validation = validateReceipt(chosen);
    setError(validation);
    if (validation) {
      setFile(null);
      if (document.getElementById("receipt"))
        document.getElementById("receipt").value = "";
      return;
    }
    setFile(chosen);
    setReceiptGeneration((value) => value + 1);
  }
  function dropReceipt(event) {
    event.preventDefault();
    setDragging(false);
    if (busy) return;
    if (event.dataTransfer.files.length !== 1) {
      setError("Choose one receipt file at a time.");
      return;
    }
    chooseReceipt(event.dataTransfer.files[0]);
  }
  async function save(event) {
    event.preventDefault();
    setError("");
    if ((file || !expense?.attachment_url) && validateReceipt(file)) {
      setError(validateReceipt(file));
      return;
    }
    if (!form.description.trim()) {
      setError("Add a description of the business purpose.");
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(form.amount) || Number(form.amount) <= 0) {
      setError("Enter a positive amount with up to two decimal places.");
      return;
    }
    setBusy(true);
    let currentId = id || savedId;
    try {
      const payload = {
        ...form,
        amount: Number(form.amount).toFixed(2),
        category_id: Number(form.category_id),
        description: form.description.trim(),
      };
      const result = currentId
        ? await api.updateExpense(currentId, payload)
        : await api.createExpense(payload);
      currentId = result.id;
      setSavedId(result.id);
      if (file) await api.uploadReceipt(result.id, file);
      notify(
        id
          ? "Your changes have been saved."
          : "Expense submitted for manager review.",
      );
      navigate(`/employee/expenses?expense=${result.id}`);
    } catch (err) {
      setError(
        `${currentId ? "Your request is saved. " : ""}${err.message}${currentId ? " You can retry here without creating a duplicate request." : ""}`,
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <BackLink to="/employee/expenses">Back to my expenses</BackLink>
      <PageHeading
        eyebrow={
          id ? `Expense #${id}` : "A receipt today. A clear record tomorrow."
        }
        title={id ? "Update your expense" : "Submit a new expense"}
        description={
          id
            ? "Update the details and receipt while awaiting review."
            : "Add the details below. Your manager will take it from here."
        }
      />
      {expense && (
        <ApprovalProgressBar
          status={expense.status}
          approvals={expense.approvals}
          className="mb-6"
        />
      )}
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <form className="card p-5 sm:p-7" onSubmit={save}>
          <fieldset disabled={busy} className="min-w-0 space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-5">
              <span className="expense-icon">
                <FileText size={20} />
              </span>
              <div>
                <h2 className="font-semibold">Expense details</h2>
                <p className="mt-1 text-xs text-slate-400">
                  All fields are required.
                </p>
              </div>
            </div>
            <ErrorBox message={error} />
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="amount" className="field-label">
                  Amount ({CURRENCY})
                </label>
                <div className="relative">
                  <input
                    id="amount"
                    name="amount"
                    className="input pr-14 tabular-nums"
                    dir="auto"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={form.amount}
                    onChange={setField}
                    required
                  />
                  <span className="absolute right-3 top-3 text-sm text-slate-400">
                    {CURRENCY}
                  </span>
                </div>
              </div>
              <div>
                <label htmlFor="expense_date" className="field-label">
                  Expense date
                </label>
                <input
                  id="expense_date"
                  name="expense_date"
                  className="input tabular-nums"
                  dir="auto"
                  type="date"
                  max={today()}
                  value={form.expense_date}
                  onChange={setField}
                  required
                />
              </div>
            </div>
            <div>
              <label htmlFor="category_id" className="field-label">
                Category
              </label>
              <select
                id="category_id"
                name="category_id"
                className="input"
                dir="auto"
                value={form.category_id}
                onChange={setField}
                required
              >
                <option value="" disabled>
                  Select an expense category
                </option>
                {initial.data.categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="description" className="field-label">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                className="input min-h-32 resize-y leading-7"
                dir="auto"
                placeholder="What was this expense for? Add a little context for your manager."
                maxLength={DESCRIPTION_MAX_LENGTH}
                value={form.description}
                onChange={setField}
                required
              />
              <p className="mt-2 text-right text-xs tabular-nums text-slate-400">
                {form.description.length} / {DESCRIPTION_MAX_LENGTH}
              </p>
            </div>
            <div>
              <label htmlFor="receipt" className="field-label">
                Receipt attachment
              </label>
              <div
                className={
                  "upload-zone " +
                  (dragging
                    ? "border-emerald-600 ring-2 ring-emerald-500/20"
                    : "")
                }
                onDragOver={(event) => {
                  event.preventDefault();
                  if (!busy) setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={dropReceipt}
              >
                <Upload size={25} className="mx-auto mb-3 text-emerald-600" />
                <p className="text-sm font-medium text-slate-700">
                  Choose a clear copy of your receipt
                </p>
                <p id="receipt-help" className="mt-2 text-xs text-slate-400">
                  One JPG, PNG, or PDF · Up to {FILE_SIZE_LABEL}
                </p>
                <input
                  id="receipt"
                  type="file"
                  accept={FILE_ACCEPT}
                  aria-describedby="receipt-help"
                  className="mt-4 w-full max-w-xs text-xs text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-emerald-50 file:px-4 file:py-2 file:font-semibold file:text-emerald-700 hover:file:bg-emerald-100"
                  onChange={(event) => chooseReceipt(event.target.files[0])}
                />
              </div>
              {file && (
                <div className="mt-3">
                  <ReceiptScanPreview key={receiptGeneration} file={file} />
                </div>
              )}
              {file ? (
                <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <Paperclip size={16} />
                  <span className="min-w-0 flex-1 truncate" dir="auto">
                    {file.name}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove selected receipt"
                    onClick={() => {
                      setFile(null);
                      document.getElementById("receipt").value = "";
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                expense?.attachment_url && (
                  <p className="mt-3 flex items-center gap-2 text-xs text-slate-500">
                    <Check size={15} className="text-emerald-600" />A receipt is
                    already attached. Choose a file to replace it.
                  </p>
                )
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-100 pt-5">
              <Link
                to="/employee/expenses"
                className={`btn-secondary ${busy ? "pointer-events-none opacity-50" : ""}`}
              >
                Cancel
              </Link>
              <button className="btn-primary" type="submit" value="save">
                {busy ? (
                  <LoaderCircle size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
                {busy
                  ? "Saving expense…"
                  : id
                    ? "Save changes"
                    : "Submit expense"}
              </button>
            </div>
          </fieldset>
        </form>
        <aside className="card p-6">
          <span className="mb-4 flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Check size={22} />
          </span>
          <h2 className="font-semibold">A smooth path to approval</h2>
          <ol className="mt-5 space-y-5">
            {[
              "Add the amount and business purpose.",
              "Attach one readable receipt.",
              "Your manager reviews the request.",
            ].map((text, index) => (
              <li
                className="flex gap-3 text-sm leading-6 text-slate-500"
                key={text}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium tabular-nums text-slate-500">
                  {index + 1}
                </span>
                {text}
              </li>
            ))}
          </ol>
          <p className="mt-6 border-t border-slate-100 pt-4 text-xs leading-6 text-slate-400">
            All expenses are recorded in Saudi Riyal ({CURRENCY}). Keep the
            original receipt for your records.
          </p>
        </aside>
      </div>
    </>
  );
}
