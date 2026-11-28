export const STATUS = Object.freeze({
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
});
export const STATUS_META = {
  [STATUS.PENDING]: {
    label: "Pending",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
  [STATUS.APPROVED]: {
    label: "Approved",
    className: "bg-emerald-50 text-emerald-700 border-emerald-200",
  },
  [STATUS.REJECTED]: {
    label: "Rejected",
    className: "bg-rose-50 text-rose-700 border-rose-200",
  },
};
export const PERMISSIONS = {
  OWN: "expenses.view_own",
  DEPARTMENT: "expenses.view_department",
  FINANCE: "expenses.view_all",
};
export const EDITABLE_STATUSES = [STATUS.PENDING];
export const DECISION = {
  APPROVE: "approve",
  REJECT: "reject",
};
export const DECISION_STATUS = {
  [DECISION.APPROVE]: STATUS.APPROVED,
  [DECISION.REJECT]: STATUS.REJECTED,
};
export const DECISIONS_REQUIRING_NOTE = [DECISION.REJECT];
export const CATEGORIES = Object.freeze([
  "Food",
  "Travel",
  "Transportation",
  "Office Supplies",
  "IT & Telecom",
  "Equipment & Maintenance",
]);
export const ROLE_PERMISSIONS = Object.freeze({
  employee: [PERMISSIONS.OWN],
  manager: [PERMISSIONS.OWN, PERMISSIONS.DEPARTMENT],
  finance: [PERMISSIONS.FINANCE],
  finance_admin: [PERMISSIONS.FINANCE],
  admin: [PERMISSIONS.OWN, PERMISSIONS.DEPARTMENT, PERMISSIONS.FINANCE],
});
export const CURRENCY = "SAR";
export const TIME_ZONE = "Asia/Riyadh";
export const PAGE_SIZE = 6;
export const API_PAGE_SIZE = 100;
export const MAX_FILE_SIZE = 5 * 1024 * 1024;
export const FILE_SIZE_LABEL = "5 MB";
export const ALLOWED_FILE_TYPES = [
  "image/jpeg",
  "image/png",
  "application/pdf",
];
export const FILE_ACCEPT = ".jpg,.jpeg,.png,.pdf";
export const DESCRIPTION_MAX_LENGTH = 2000;
export const NOTE_MAX_LENGTH = 2000;
export const STORAGE_KEYS = { TOKEN: "masroof.token", DATA: "masroof.demo.v2" };
export const SESSION_EXPIRED_EVENT = "masroof:session-expired";
export const MOCK_DELAY = 180;
export function hasPermission(user, permission) {
  return Boolean(ROLE_PERMISSIONS[user?.role]?.includes(permission));
}
export function canUseFinance(user) {
  return hasPermission(user, PERMISSIONS.FINANCE);
}
export function homeFor(user) {
  if (canUseFinance(user)) return "/finance/dashboard";
  if (hasPermission(user, PERMISSIONS.DEPARTMENT)) return "/manager/dashboard";
  if (hasPermission(user, PERMISSIONS.OWN)) return "/employee/dashboard";
  return "/access-denied";
}
export function validateReceipt(file) {
  if (!file) return "Attach one receipt to submit your expense.";
  if (!ALLOWED_FILE_TYPES.includes(file.type))
    return "Choose a JPG, PNG, or PDF receipt.";
  if (file.size === 0) return "The receipt is empty. Choose another file.";
  if (file.size > MAX_FILE_SIZE)
    return `The receipt must be ${FILE_SIZE_LABEL} or smaller.`;
  return "";
}
