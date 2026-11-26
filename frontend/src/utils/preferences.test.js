// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  applyDensityPreference,
  DEFAULT_PREFERENCES,
  getUserPreferences,
  PREFERENCES_UPDATED_EVENT,
  resetUserPreferences,
  saveUserPreferences,
} from "./preferences";
import { getLandingOptions, preferredHomeFor } from "./workspaceRoutes";

beforeEach(() => localStorage.clear());
afterEach(() => {
  applyDensityPreference(false);
  vi.restoreAllMocks();
});

it("returns defaults for missing, malformed, and unavailable storage", () => {
  expect(getUserPreferences(12)).toEqual(DEFAULT_PREFERENCES);
  localStorage.setItem("masroof_user_prefs_12", "{");
  expect(getUserPreferences(12)).toEqual(DEFAULT_PREFERENCES);
  localStorage.setItem(
    "masroof_user_prefs_12",
    '{"compactTables":"false","showNotificationBadge":false}',
  );
  expect(getUserPreferences(12)).toEqual({
    ...DEFAULT_PREFERENCES,
    showNotificationBadge: false,
  });
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("Unavailable");
  });
  expect(getUserPreferences(12)).toEqual(DEFAULT_PREFERENCES);
});

it("persists preferences per user, synchronizes density and dispatches save and reset events", () => {
  const listener = vi.fn();
  window.addEventListener(PREFERENCES_UPDATED_EVENT, listener);
  try {
    const prefs = saveUserPreferences(12, {
      compactTables: true,
      showNotificationBadge: false,
    });
    expect(JSON.parse(localStorage.getItem("masroof_user_prefs_12"))).toEqual(
      prefs,
    );
    expect(getUserPreferences(12)).toEqual({
      ...DEFAULT_PREFERENCES,
      compactTables: true,
      showNotificationBadge: false,
    });
    expect(getUserPreferences(5)).toEqual(DEFAULT_PREFERENCES);
    expect(document.documentElement.dataset.density).toBe("compact");
    expect(listener.mock.lastCall[0].detail).toEqual({
      userId: 12,
      preferences: prefs,
    });

    resetUserPreferences(12);
    expect(getUserPreferences(12)).toEqual(DEFAULT_PREFERENCES);
    expect(document.documentElement.hasAttribute("data-density")).toBe(false);
    expect(listener.mock.lastCall[0].detail).toEqual({
      userId: 12,
      preferences: DEFAULT_PREFERENCES,
    });
  } finally {
    window.removeEventListener(PREFERENCES_UPDATED_EVENT, listener);
  }
});

it("only uses saved landing pages allowed by the current role", () => {
  saveUserPreferences(12, { defaultLandingRoute: "/reports" });
  expect(preferredHomeFor({ id: 12, role: "manager" })).toBe("/reports");
  expect(preferredHomeFor({ id: 12, role: "employee" })).toBe(
    "/employee/dashboard",
  );
  expect(preferredHomeFor({ id: 12, role: "unknown" })).toBe("/access-denied");
  expect(
    getLandingOptions({ role: "finance" }).map(([route]) => route),
  ).toEqual([
    "/finance/dashboard",
    "/finance/budgets",
    "/finance/limits",
    "/finance/forecast",
    "/reports",
  ]);
});
