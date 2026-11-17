import { Download, FileText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ErrorBox, Spinner } from './UI';
export default function ReceiptViewer({ expense }) {
  const [state, setState] = useState({ loading: true }); const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true; let objectUrl;
    setState({ loading: true });
    if (!expense.attachment_url) { setState({ loading: false }); return; }
    api.receipt(expense).then((receipt) => { objectUrl = receipt.url; if (active) setState({ loading: false, receipt }); else URL.revokeObjectURL(objectUrl); })
      .catch((error) => { if (active) setState({ loading: false, error: error.message }); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [expense.id, expense.attachment_url, attempt]);
  return <section className="card overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5"><h2 className="flex items-center gap-2 font-semibold"><FileText size={18} className="text-slate-400" />Receipt attachment</h2>{state.receipt && <a className="text-link text-xs" href={state.receipt.url} download={state.receipt.name}><Download size={14} />Download</a>}</div><div className="receipt-canvas">{state.loading ? <Spinner label="Opening receipt…" /> : state.error ? <ErrorBox message={state.error} retry={() => setAttempt((value) => value + 1)} /> : !state.receipt ? <p className="p-8 text-center text-sm text-slate-500">No receipt attached.</p> : state.receipt.type.startsWith('image/') ? <img src={state.receipt.url} alt={`Receipt for expense #${expense.id}`} className="mx-auto max-h-[720px] w-full max-w-lg rounded border border-slate-200 bg-white object-contain shadow-sm" /> : state.receipt.type === 'application/pdf' ? <object data={state.receipt.url} type="application/pdf" className="h-[600px] w-full" aria-label="Receipt PDF preview"><p className="p-8 text-sm">Your browser cannot preview this PDF. <a href={state.receipt.url} download={state.receipt.name} className="text-link">Download receipt</a></p></object> : <p className="p-8 text-sm text-slate-500">Preview unavailable. Use Download to open the receipt.</p>}</div></section>;
}
