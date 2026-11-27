import { Check, X } from "lucide-react";
import { DECISION, STATUS, STATUS_META } from "../utils/constants";
import { formatDate } from "../utils/formatters";

function timelineBadge(decision) {
  if ([STATUS.REJECTED, DECISION.REJECT].includes(decision))
    return { Icon: X, className: "bg-rose-50 text-rose-600" };
  return { Icon: Check, className: "bg-emerald-50 text-emerald-600" };
}

export default function ApprovalTimeline({
  approvals = [],
  createdAt,
  requesterName,
}) {
  return (
    <section className="card p-5">
      <h2 className="mb-6 font-semibold text-slate-900">Approval history</h2>
      <ol className="timeline">
        <li>
          <span className="timeline-dot bg-emerald-50 text-emerald-600">
            <Check size={13} aria-hidden="true" />
          </span>
          <p className="text-sm font-medium">Expense submitted</p>
          <p className="mt-1 text-xs text-slate-500" dir="auto">
            {requesterName}
          </p>
          <time className="mt-1 block text-xs tabular-nums text-slate-400">
            {formatDate(createdAt, { hour: "2-digit", minute: "2-digit" })}
          </time>
        </li>
        {approvals.map((entry) => {
          const { Icon, className } = timelineBadge(entry.decision);
          return (
            <li key={entry.id}>
              <span className={`timeline-dot ${className}`}>
                <Icon size={13} aria-hidden="true" />
              </span>
              <p className="text-sm font-medium">
                {STATUS_META[entry.decision]?.label || entry.decision}
              </p>
              <p className="mt-1 text-xs text-slate-500" dir="auto">
                {entry.actor_name}
              </p>
              {entry.note && (
                <p
                  className="mt-2 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600"
                  dir="auto"
                >
                  {entry.note}
                </p>
              )}
              <time className="mt-2 block text-xs tabular-nums text-slate-400">
                {formatDate(entry.created_at, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
