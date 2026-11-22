import { forwardRef } from "react";
import { AnimatePresence, motion, useIsPresent } from "motion/react";
import { useFintechMotion } from "./useFintechMotion";

const ROW_CLASS = "group";
const AnimatedRow = forwardRef(function AnimatedRow({ children }, ref) {
  const present = useIsPresent();
  return (
    <motion.tr
      ref={ref}
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      className={ROW_CLASS}
      aria-hidden={present ? undefined : true}
      style={
        present
          ? undefined
          : { display: "table", tableLayout: "fixed", pointerEvents: "none" }
      }
    >
      {children}
    </motion.tr>
  );
});

export default function AnimatedExpenseRows({ expenses, children }) {
  const { layoutEnabled } = useFintechMotion();
  if (!layoutEnabled)
    return expenses.map((expense) => (
      <tr key={expense.id} className={ROW_CLASS}>
        {children(expense)}
      </tr>
    ));
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {expenses.map((expense) => (
        <AnimatedRow key={expense.id}>{children(expense)}</AnimatedRow>
      ))}
    </AnimatePresence>
  );
}
