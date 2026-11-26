// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { api, setToken } from "../services/api";
import { hasPermission, homeFor, PERMISSIONS } from "../utils/constants";

let host;
let root;
let auth;
function Consumer() {
  auth = useAuth();
  return null;
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  setToken(null);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it.each([
  ["employee", [PERMISSIONS.OWN], "/employee/dashboard"],
  ["manager", [PERMISSIONS.OWN, PERMISSIONS.DEPARTMENT], "/manager/dashboard"],
  ["finance", [PERMISSIONS.FINANCE], "/finance/dashboard"],
  ["admin", Object.values(PERMISSIONS), "/finance/dashboard"],
  ["unknown", [], "/access-denied"],
])(
  "derives %s access from its role at login and session restore",
  async (role, permissions, home) => {
    const profile = {
      id: 1,
      role,
      permissions: ["untrusted.permission"],
      is_superuser: true,
    };
    vi.spyOn(api, "login").mockResolvedValue(profile);
    vi.spyOn(api, "me").mockResolvedValue(profile);
    await act(async () =>
      root.render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      ),
    );
    let result;
    await act(async () => {
      result = await auth.login("user", "password");
    });
    expect(result.permissions).toEqual(permissions);
    expect(auth.user.permissions).toEqual(permissions);
    expect(auth.permissions).toEqual(permissions);
    expect(homeFor(auth.user)).toBe(home);
    for (const permission of Object.values(PERMISSIONS)) {
      expect(hasPermission(profile, permission)).toBe(
        permissions.includes(permission),
      );
    }
    await act(async () => root.unmount());
    setToken("saved-token");
    root = createRoot(host);
    await act(async () =>
      root.render(
        <AuthProvider>
          <Consumer />
        </AuthProvider>,
      ),
    );
    expect(auth.loading).toBe(false);
    expect(auth.user.permissions).toEqual(permissions);
    expect(auth.permissions).toEqual(permissions);
  },
);
