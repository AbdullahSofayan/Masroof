export const recordName = (value) =>
  typeof value === "string" ? value : value?.name;

export function toSpendExpense(expense) {
  const requester =
    expense.requester ??
    (typeof expense.employee === "object" ? expense.employee : null);
  const amount = Number(expense.amount);
  const departmentId =
    expense.department?.id ?? expense.department_id ?? expense.departmentId;
  const departmentName =
    expense.departmentName ?? (recordName(expense.department) || "");
  return {
    id: expense.id ?? expense.expense_id ?? "",
    title: expense.title || expense.description || "",
    employeeName:
      requester?.full_name ||
      requester?.name ||
      expense.employeeName ||
      (typeof expense.employee === "string" ? expense.employee : "") ||
      expense.userName ||
      "",
    requesterId:
      requester?.id ??
      expense.requester_id ??
      expense.requesterId ??
      expense.employeeId,
    requesterEmail:
      requester?.email || expense.requesterEmail || expense.employeeEmail,
    departmentId,
    departmentName,
    department:
      departmentName ||
      (departmentId != null ? `Department ${departmentId}` : ""),
    category: recordName(expense.category) || "",
    amount:
      expense.amount == null ||
      expense.amount === "" ||
      !Number.isFinite(amount)
        ? null
        : amount,
    status: String(expense.status ?? "").toLowerCase(),
    date:
      expense.date ||
      expense.expense_date ||
      expense.created_at ||
      expense.createdAt ||
      "",
    createdAt: expense.created_at || expense.createdAt,
    updatedAt: expense.updated_at || expense.updatedAt,
    approvals: Array.isArray(expense.approvals) ? expense.approvals : [],
    note:
      expense.reviewerComment ||
      expense.reviewer_comment ||
      expense.rejectionNote ||
      expense.rejection_note ||
      expense.reason,
  };
}
