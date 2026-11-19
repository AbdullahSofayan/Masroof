import { CURRENCY, TIME_ZONE } from "./constants";
export const formatMoney = (amount) =>
  new Intl.NumberFormat("en-SA", {
    style: "currency",
    currency: CURRENCY,
    currencyDisplay: "code",
    minimumFractionDigits: 2,
  }).format(Number(amount) || 0);
export function formatDate(value, options = {}) {
  if (!value || Number.isNaN(new Date(value).getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TIME_ZONE,
    ...options,
  }).format(new Date(value));
}
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const initials = (name = "") =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");

export function userDisplayName(user) {
  return (
    user?.full_name || user?.name || user?.username || user?.email || "Account"
  );
}
