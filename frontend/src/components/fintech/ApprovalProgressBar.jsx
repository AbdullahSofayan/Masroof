import { Check, RotateCcw, X } from "lucide-react";
import { motion } from "motion/react";
import { STATUS } from "../../utils/constants";
import { useFintechMotion } from "./useFintechMotion";

const STEPS = ["Submitted", "Manager Review", "Finance Review", "Approved"];
export function approvalStage(status, approvals = []) {
  if (status === STATUS.APPROVED) return 3;
  if (status === STATUS.PENDING_FINANCE) return 2;
  if (
    status === STATUS.REJECTED &&
    approvals.some((entry) => entry.decision === STATUS.PENDING_FINANCE)
  )
    return 2;
  if (
    [STATUS.PENDING_MANAGER, STATUS.NEEDS_CHANGES, STATUS.REJECTED].includes(
      status,
    )
  )
    return 1;
  return 0;
}

export default function ApprovalProgressBar({
  status,
  approvals = [],
  className = "",
}) {
  const { enabled } = useFintechMotion();
  const active = approvalStage(status, approvals);
  const changes = status === STATUS.NEEDS_CHANGES;
  const rejected = status === STATUS.REJECTED;
  const branch = changes || rejected;
  const fill = rejected
    ? "bg-rose-500"
    : changes
      ? "bg-amber-500"
      : "bg-emerald-600";
  const width = `${(active / (STEPS.length - 1)) * 100}%`;
  const Fill = enabled ? motion.div : "div";
  return (
    <section
      className={`card px-3 py-5 sm:px-5 ${className}`}
      aria-label="Approval progress"
    >
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute top-4 right-[12.5%] left-[12.5%] h-0.5 overflow-hidden bg-slate-100"
        >
          <Fill
            className={`h-full ${fill}`}
            style={{ width }}
            {...(enabled
              ? {
                  initial: { width: "0%" },
                  animate: { width },
                  transition: { duration: 0.5, ease: "easeOut" },
                }
              : {})}
          />
        </div>
        <ol className="relative grid grid-cols-4 gap-1">
          {STEPS.map((label, index) => {
            const completed = index < active || status === STATUS.APPROVED;
            const current = index === active;
            const color =
              current && branch
                ? rejected
                  ? "bg-rose-500 text-white ring-4 ring-rose-500/15"
                  : "bg-amber-500 text-white ring-4 ring-amber-500/15"
                : completed
                  ? "bg-emerald-600 text-white"
                  : current
                    ? "bg-emerald-600 text-white ring-4 ring-emerald-500/15"
                    : "bg-slate-100 text-slate-400";
            return (
              <li
                key={label}
                aria-current={current ? "step" : undefined}
                className="flex flex-col items-center gap-2 text-center"
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors duration-250 ${color}`}
                >
                  {current && rejected ? (
                    <X size={15} aria-hidden="true" />
                  ) : current && changes ? (
                    <RotateCcw size={14} aria-hidden="true" />
                  ) : completed ? (
                    <Check size={15} aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={`text-[10px] font-medium sm:text-xs ${current ? "text-slate-800" : "text-slate-400"}`}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      {branch && (
        <p
          role="status"
          className={`mt-4 rounded-lg px-3 py-2 text-center text-xs ${rejected ? "bg-rose-50 text-rose-700" : "bg-amber-50 text-amber-700"}`}
        >
          {changes
            ? "Needs Changes · Returned to the requester for an update."
            : "Rejected · This request will not continue to approval."}
        </p>
      )}
    </section>
  );
}
