import { motion } from "motion/react";
import { formatMoney } from "../../utils/formatters";
import { useFintechMotion } from "./useFintechMotion";

export default function BudgetProgressBar({
  spent,
  budget,
  label = "Budget utilization",
  className = "",
}) {
  const { enabled } = useFintechMotion();
  const amount = Number.isFinite(Number(spent))
    ? Math.max(0, Number(spent))
    : 0;
  const known =
    budget !== null &&
    budget !== undefined &&
    Number.isFinite(Number(budget)) &&
    Number(budget) > 0;
  const percent = known ? (amount / Number(budget)) * 100 : 0;
  const width = `${Math.min(100, percent)}%`;
  const color =
    percent < 75
      ? "bg-emerald-500"
      : percent <= 90
        ? "bg-amber-500"
        : "bg-rose-500";
  const Fill = enabled ? motion.div : "div";
  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-slate-500">{label}</span>
        <span className="font-medium tabular-nums text-slate-700">
          {formatMoney(amount)} /{" "}
          {known ? formatMoney(budget) : "Budget unavailable"}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={
          known ? Math.min(100, Number(percent.toFixed(2))) : undefined
        }
        aria-valuetext={
          known
            ? `${percent.toFixed(1)}% utilized${percent > 100 ? " — over budget" : ""}`
            : "Budget unavailable"
        }
        className="h-2 w-full overflow-hidden rounded-full bg-slate-100"
      >
        <Fill
          className={`h-full rounded-full ${color}`}
          style={{ width }}
          {...(enabled
            ? {
                initial: { width: "0%" },
                animate: { width },
                transition: { duration: 0.75, ease: "easeOut" },
              }
            : {})}
        />
      </div>
      <p
        className={`mt-2 text-right text-[11px] tabular-nums ${percent > 90 ? "text-rose-600" : "text-slate-400"}`}
      >
        {known
          ? `${percent.toLocaleString("en-US", { maximumFractionDigits: 1 })}% utilized${percent > 100 ? " · Over allocation" : ""}`
          : "A budget has not been supplied."}
      </p>
    </div>
  );
}
