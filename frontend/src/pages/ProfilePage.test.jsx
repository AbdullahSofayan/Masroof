// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import App from "../App";
import { api } from "../services/api";
import { demoUsers } from "../services/mockData";
import { DEFAULT_PREFERENCES, saveUserPreferences } from "../utils/preferences";

const auth = vi.hoisted(() => ({ user: null, logout: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));

let host;
let root;
let location;
const button = (label) =>
  [...host.querySelectorAll("button")].find(
    (node) => node.textContent.trim() === label,
  );
const savedPreferences = () =>
  JSON.parse(localStorage.getItem(`masroof_user_prefs_${auth.user.id}`));
function LocationProbe() {
  location = useLocation().pathname;
  return null;
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(api, "allExpenses").mockResolvedValue([]);
  localStorage.clear();
  auth.user = demoUsers.find(({ role }) => role === "manager");
  host = document.body.appendChild(document.createElement("div"));
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function open(path = "/profile") {
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <App />
        <LocationProbe />
      </MemoryRouter>,
    ),
  );
}

it("shows account information, manager permissions, and an active profile link", async () => {
  await open();
  const identity = host.querySelector(
    'section[aria-labelledby="account-heading"]',
  );
  expect(identity.textContent).toContain(auth.user.full_name);
  expect(identity.textContent).toContain(auth.user.email);
  expect(identity.textContent).toContain(auth.user.department.name);
  expect(identity.textContent).toContain("Manager");
  expect(identity.textContent).toContain("Mock Data Mode");
  expect(host.textContent).toContain(
    "Make final approval or rejection decisions",
  );
  expect(
    host
      .querySelector('a[aria-label="Profile & Settings"]')
      .getAttribute("aria-current"),
  ).toBe("page");
  expect(
    host.querySelector('#preference-landing option[value^="/finance"]'),
  ).toBeNull();
});

it("saves and resets preferences and delegates sign-out to auth", async () => {
  await open();
  const density = host.querySelector("#preference-density");
  const notifications = host.querySelector("#preference-notifications");
  const landing = host.querySelector("#preference-landing");
  await act(async () => {
    density.click();
    notifications.click();
    landing.value = "/reports";
    landing.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await act(async () => button("Save Preferences").click());
  expect(savedPreferences()).toEqual({
    compactTables: true,
    showNotificationBadge: false,
    defaultLandingRoute: "/reports",
  });
  expect(document.documentElement.dataset.density).toBe("compact");
  expect(host.querySelector("form [role=status]").textContent).toBe(
    "Preferences saved",
  );
  await act(async () => button("Reset Defaults").click());
  expect(savedPreferences()).toEqual(DEFAULT_PREFERENCES);
  expect(density.getAttribute("aria-checked")).toBe("false");
  expect(notifications.getAttribute("aria-checked")).toBe("true");
  expect(landing.value).toBe("role-default");
  expect(host.querySelector("form [role=status]").textContent).toBe(
    "Preferences reset to defaults",
  );
  expect(document.documentElement.dataset.density).toBeUndefined();
  await act(async () => button("Sign Out").click());
  expect(auth.logout).toHaveBeenCalledOnce();
});

it("applies the saved landing route and density on entering the workspace", async () => {
  saveUserPreferences(auth.user.id, {
    compactTables: true,
    defaultLandingRoute: "/reports",
  });
  document.documentElement.removeAttribute("data-density");
  await open("/");
  expect(location).toBe("/reports");
  expect(host.querySelector("h1").textContent).toBe("Reports & Analytics");
  expect(document.documentElement.dataset.density).toBe("compact");
});

it("hides reports navigation and denies direct reports access for an employee", async () => {
  auth.user = demoUsers.find(({ role }) => role === "employee");
  await open();
  expect(host.querySelector('a[href="/reports"]')).toBeNull();
  expect(
    host.querySelector('#preference-landing option[value="/reports"]'),
  ).toBeNull();
  await act(async () => root.render(null));
  await open("/reports");
  expect(location).toBe("/access-denied");
  expect(host.textContent).toContain("Access restricted");
});

it("requires a session to open the profile", async () => {
  auth.user = null;
  await open();
  expect(location).toBe("/login");
});
