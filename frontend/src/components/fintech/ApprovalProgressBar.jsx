import { Check, X } from "lucide-react";
import { motion } from "motion/react";
import { STATUS } from "../../utils/constants";
import { useFintechMotion } from "./useFintechMotion";

const STEPS = ["Submitted", "Pending", "Approved"];
export function approvalStage(status) {
  if (status === STATUS.APPROVED || status === STATUS.REJECTED) return 2;
  return status === STATUS.PENDING ? 1 : 0;
}

export default function ApprovalProgressBar({ status, className = "" }) {
  const { enabled } = useFintechMotion();
  const active = approvalStage(status);
  const rejected = status === STATUS.REJECTED;
  const fill = rejected ? "bg-rose-500" : "bg-emerald-600";
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
          className="absolute top-4 right-[16.6667%] left-[16.6667%] h-0.5 overflow-hidden bg-slate-100"
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
        <ol className="relative grid grid-cols-3 gap-1">
          {STEPS.map((step, index) => {
            const label = rejected && index === 2 ? "Rejected" : step;
            const completed = index < active || status === STATUS.APPROVED;
            const current = index === active;
            const color =
              current && rejected
                ? "bg-rose-500 text-white ring-4 ring-rose-500/15"
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
      {rejected && (
        <p
          role="status"
          className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-center text-xs text-rose-700"
        >
          {"Rejected · This request will not continue to approval."}
        </p>
      )}
    </section>
  );
}
