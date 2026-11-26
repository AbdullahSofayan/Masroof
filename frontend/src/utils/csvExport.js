import { STATUS_META } from "./constants";
import { today } from "./formatters";
import { toSpendExpense } from "./expenseFields";

export function escapeCsvField(value) {
  const text = String(value ?? "");
  const safe =
    typeof value === "string" && /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function buildExpensesCsv(expenses) {
  const header =
    "ID,Title,Employee,Department,Category,Amount (SAR),Status,Date";
  const rows = expenses.map((expense) => {
    const {
      id,
      title,
      employeeName,
      department,
      category,
      amount,
      status,
      date,
    } = toSpendExpense(expense);
    return [
      id,
      title,
      employeeName,
      department,
      category,
      amount,
      STATUS_META[status]?.label || "",
      date,
    ]
      .map(escapeCsvField)
      .join(",");
  });
  return `\uFEFF${[header, ...rows].join("\r\n")}`;
}

export function downloadExpensesCsv(
  expenses,
  filename = `masroof-expense-report-${today()}.csv`,
) {
  const blob = new Blob([buildExpensesCsv(expenses)], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  try {
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
