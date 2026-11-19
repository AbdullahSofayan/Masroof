export const DEFAULT_PREFERENCES = Object.freeze({
  showNotificationBadge: true,
  compactTables: false,
  defaultLandingRoute: "role-default",
});

export const PREFERENCES_UPDATED_EVENT = "masroof:preferences-updated";

const storageKey = (userId) => `masroof_user_prefs_${userId || "guest"}`;

function normalizePreferences(prefs) {
  return {
    showNotificationBadge:
      typeof prefs?.showNotificationBadge === "boolean"
        ? prefs.showNotificationBadge
        : DEFAULT_PREFERENCES.showNotificationBadge,
    compactTables: prefs?.compactTables === true,
    defaultLandingRoute:
      typeof prefs?.defaultLandingRoute === "string"
        ? prefs.defaultLandingRoute
        : DEFAULT_PREFERENCES.defaultLandingRoute,
  };
}

export function getUserPreferences(userId) {
  try {
    return normalizePreferences(
      JSON.parse(window.localStorage.getItem(storageKey(userId))),
    );
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function applyDensityPreference(isCompact) {
  if (typeof document === "undefined") return;
  if (isCompact)
    document.documentElement.setAttribute("data-density", "compact");
  else document.documentElement.removeAttribute("data-density");
}

export function saveUserPreferences(userId, prefs) {
  const preferences = normalizePreferences(prefs);
  try {
    window.localStorage.setItem(
      storageKey(userId),
      JSON.stringify(preferences),
    );
  } catch {
    // Apply the preferences for this session even when storage is unavailable.
  }
  applyDensityPreference(preferences.compactTables);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(PREFERENCES_UPDATED_EVENT, {
        detail: { userId, preferences },
      }),
    );
  }
  return preferences;
}

export function resetUserPreferences(userId) {
  return saveUserPreferences(userId, DEFAULT_PREFERENCES);
}
