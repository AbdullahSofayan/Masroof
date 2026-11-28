import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useAnimationControls } from "motion/react";
import { STATUS_META } from "../utils/constants";
import { useFintechMotion } from "./fintech/useFintechMotion";

export default function StatusBadge({ status }) {
  const { enabled } = useFintechMotion();
  const controls = useAnimationControls();
  const previous = useRef(status);
  const meta = STATUS_META[status];
  const label = meta?.label || "Unknown status";
  useEffect(() => {
    if (enabled && previous.current !== status)
      controls.start({ scale: [0.96, 1], transition: { duration: 0.22 } });
    previous.current = status;
  }, [status, enabled, controls]);
  const Badge = enabled ? motion.span : "span";
  return (
    <Badge
      data-status={status}
      className={`status-badge transition-colors duration-250 ${meta?.className || "border-slate-200 bg-slate-50 text-slate-600"}`}
      {...(enabled ? { initial: false, animate: controls } : {})}
    >
      <span aria-hidden="true" className="status-dot" />
      {enabled ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={status}
            initial={{ opacity: 0, y: 2 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -2 }}
            transition={{ duration: 0.12 }}
          >
            {label}
          </motion.span>
        </AnimatePresence>
      ) : (
        <span>{label}</span>
      )}
    </Badge>
  );
}
