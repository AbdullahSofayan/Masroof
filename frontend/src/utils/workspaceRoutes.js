import {
  canUseFinance,
  hasPermission,
  homeFor,
  PERMISSIONS,
} from "./constants";
import { getUserPreferences } from "./preferences";

export const REPORT_ROLES = Object.freeze(["manager", "finance", "finance_admin", "admin"]);

export function getWorkspaceViews(user) {
  return [
    hasPermission(user, PERMISSIONS.OWN) && ["employee", "Employee workspace"],
    hasPermission(user, PERMISSIONS.DEPARTMENT) && [
      "manager",
      "Manager workspace",
    ],
    canUseFinance(user) && ["finance", "Finance workspace"],
  ].filter(Boolean);
}

export function getLandingOptions(user) {
  return [
    ...getWorkspaceViews(user).map(([area, label]) => [
      `/${area}/dashboard`,
      label,
    ]),
    hasPermission(user, PERMISSIONS.OWN) && [
      "/employee/expenses",
      "My expenses",
    ],
    canUseFinance(user) && ["/finance/budgets", "Budgets"],
    canUseFinance(user) && ["/finance/limits", "Category limits"],
    canUseFinance(user) && ["/finance/forecast", "Forecast"],
    REPORT_ROLES.includes(user?.role) && ["/reports", "Reports & Analytics"],
  ].filter(Boolean);
}

export function preferredHomeFor(user) {
  const { defaultLandingRoute } = getUserPreferences(user?.id);
  return getLandingOptions(user).some(
    ([route]) => route === defaultLandingRoute,
  )
    ? defaultLandingRoute
    : homeFor(user);
}
