import { ShieldAlert, Sparkles } from "lucide-react";
export default function RiskAlertBox({ analysis }) {
  if (!analysis) return null;
  const high = analysis.risk_level?.toLowerCase() === "high";
  return (
    <section
      className={`rounded-xl border p-5 ${high ? "border-rose-200 bg-rose-50/70" : "border-amber-200 bg-amber-50/70"}`}
    >
      <div className="flex items-center gap-2">
        <ShieldAlert
          size={19}
          className={high ? "text-rose-600" : "text-amber-600"}
        />
        <h2 className="font-semibold text-slate-900">AI review insights</h2>
        <Sparkles size={15} className="ml-auto text-slate-400" />
      </div>
      <div className="my-3 flex justify-between text-sm">
        <span>{analysis.risk_level || "Unspecified"} risk</span>
        {Number.isFinite(analysis.anomaly_score) && (
          <span className="tabular-nums text-slate-500">
            Anomaly score: {Math.round(analysis.anomaly_score * 100)}%
          </span>
        )}
      </div>
      <ul className="space-y-2 text-sm leading-6 text-slate-700">
        {(analysis.warnings || []).map((warning, index) => (
          <li key={index} dir="auto">
            {warning}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        An advisory signal to support your review. Verify the receipt before
        making a decision.
      </p>
    </section>
  );
}
