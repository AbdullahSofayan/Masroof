import { STATUS } from "../utils/constants";
import { demoCategories } from "./mockData";

// Preserve browser-saved requests when upgrading the original demo workflow.
export const LEGACY_DATA_KEY = "masroof.demo.v1";
const categoryIds = { 1: 1, 2: 4, 3: 2, 4: 5, 5: 6 };
export const migrateCategoryId = (id) => categoryIds[id] ?? id;
const statuses = {
  pending_manager: STATUS.PENDING,
  needs_changes: STATUS.PENDING,
  pending_finance: STATUS.APPROVED,
};

export function migrateDemoData(expenses) {
  return expenses.map((expense) => {
    const status = statuses[expense.status] || expense.status;
    const approvals = (expense.approvals || []).map((entry) => ({
      ...entry,
      decision: statuses[entry.decision] || entry.decision,
    }));
    return {
      ...expense,
      status,
      category:
        demoCategories.find(
          (entry) => entry.id === migrateCategoryId(expense.category?.id),
        ) || expense.category,
      approvals,
    };
  });
}
