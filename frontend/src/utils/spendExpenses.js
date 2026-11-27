import { api, request, USE_MOCK } from "../services/api";
import { financeApi } from "../services/financeApi";
import {
  API_PAGE_SIZE,
  canUseFinance,
  CATEGORIES,
  STATUS_META,
} from "./constants";
import { recordName, toSpendExpense } from "./expenseFields";

const sameId = (first, second) =>
  first != null &&
  first !== "" &&
  second != null &&
  second !== "" &&
  String(first) === String(second);
const sameText = (first, second) =>
  Boolean(
    first?.trim() &&
    second?.trim() &&
    first.trim().toLowerCase() === second.trim().toLowerCase(),
  );

export function isOwnExpense(expense, user) {
  if (expense.requesterId != null && user.id != null)
    return sameId(expense.requesterId, user.id);
  if (expense.requesterEmail && user.email)
    return sameText(expense.requesterEmail, user.email);
  return (
    USE_MOCK && sameText(expense.employeeName, user.full_name || user.name)
  );
}

export function isDepartmentExpense(expense, user) {
  const departmentId = user.department_id ?? user.department?.id;
  if (expense.departmentId != null && departmentId != null)
    return sameId(expense.departmentId, departmentId);
  return (
    USE_MOCK && sameText(expense.departmentName, recordName(user.department))
  );
}

async function liveExpenses() {
  // The current endpoint sends an array. Also accept the app's paginated expense contract.
  const expenses = [];
  for (let page = 1; ; page += 1) {
    const result = await request(
      `/expenses?page=${page}&size=${API_PAGE_SIZE}`,
    );
    if (Array.isArray(result)) return result;
    if (!Array.isArray(result?.items))
      throw new Error("The expense service returned an invalid list.");
    expenses.push(...result.items);
    if (
      !result.items.length ||
      expenses.length >= result.total ||
      result.total == null
    )
      return expenses;
  }
}

export async function loadSpendExpenses(user) {
  const company = canUseFinance(user);
  const own = user.role === "employee";
  const raw = !USE_MOCK
    ? await liveExpenses()
    : company
      ? await financeApi.expenses()
      : await api.allExpenses({ view: own ? "own" : "department" });

  return raw
    .map(toSpendExpense)
    .filter(
      (expense) =>
        expense.id !== "" &&
        Object.hasOwn(STATUS_META, expense.status) &&
        CATEGORIES.includes(expense.category) &&
        (company ||
          (own
            ? isOwnExpense(expense, user)
            : isDepartmentExpense(expense, user))),
    );
}
