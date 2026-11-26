// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api } from "../services/api";
import { financeApi } from "../services/financeApi";
import { createDemoData, demoUsers } from "../services/mockData";
import { saveUserPreferences } from "../utils/preferences";
import NotificationBell from "./NotificationBell";

const state = vi.hoisted(() => ({ user: null }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => state }));

let host;
let root;
let path;
const bell = () => host.querySelector('button[aria-label="Notifications"]');
const feed = () => host.querySelector('[role="dialog"]');
const badge = () => bell().querySelector("span")?.textContent;
const open = () => act(async () => bell().click());

function LocationObserver() {
  const { pathname, search } = useLocation();
  path = pathname + search;
  return null;
}

async function mount(username, role) {
  const user = demoUsers.find((entry) => entry.username === username);
  state.user = role ? { ...user, role } : user;
  await act(async () =>
    root.render(
      <MemoryRouter>
        <NotificationBell />
        <LocationObserver />
      </MemoryRouter>,
    ),
  );
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.spyOn(document, "hidden", "get").mockReturnValue(false);
  localStorage.clear();
  vi.spyOn(api, "allExpenses").mockResolvedValue(createDemoData());
  host = document.body.appendChild(document.createElement("div"));
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("shows employees their decisions and notes, marks a clicked alert read and opens the details", async () => {
  await mount("sara");
  await open();
  const rejected = createDemoData().find(({ id }) => id === 108);
  expect(feed().textContent).toContain(rejected.approvals[0].note);
  expect(feed().textContent).toContain("Expense approved");
  expect(feed().textContent).not.toContain("Figma Professional");
  expect(api.allExpenses).toHaveBeenCalledWith({ view: "own" });
  const link = feed().querySelector('a[href="/employee/expenses?expense=108"]');
  await act(async () => link.click());
  expect(path).toBe("/employee/expenses?expense=108");
  expect(feed()).toBeNull();
  expect(
    JSON.parse(localStorage.getItem("masroof_read_notifications_5")),
  ).toEqual(["108:rejected"]);
});

it("shows managers their pending review queue and persists mark-all across mounts", async () => {
  await mount("khalid");
  expect(badge()).toBe("5");
  await open();
  expect(feed().textContent).toContain("5 unread");
  expect(feed().textContent).toContain("Figma Professional");
  expect(feed().querySelector('a[href="/manager/expenses/112"]')).toBeNull();
  expect(feed().querySelector('a[href="/manager/expenses/109"]')).toBeTruthy();
  expect(api.allExpenses).toHaveBeenCalledWith({ view: "department" });
  await act(async () =>
    [...feed().querySelectorAll("button")]
      .find((node) => node.textContent.trim() === "Mark all as read")
      .click(),
  );
  expect(badge()).toBeUndefined();
  expect(feed().textContent).toContain("0 unread");
  expect(
    JSON.parse(localStorage.getItem("masroof_read_notifications_8")),
  ).toHaveLength(5);

  await act(async () => root.render(null));
  await mount("khalid");
  expect(badge()).toBeUndefined();
});

it("shows high-value finance alerts and responds to preference updates and dismissal", async () => {
  vi.spyOn(financeApi, "expenses").mockResolvedValue(createDemoData());
  await mount("finance");
  expect(badge()).toBe("1");
  await act(async () =>
    saveUserPreferences(20, { showNotificationBadge: false }),
  );
  expect(badge()).toBeUndefined();
  await open();
  expect(feed().textContent).toContain("1 unread");
  expect(feed().textContent).toContain("High-value expense");
  expect(feed().querySelector("a").getAttribute("href")).toBe(
    "/finance/dashboard",
  );
  await act(async () =>
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
  );
  expect(bell().getAttribute("aria-expanded")).toBe("false");
  expect(document.activeElement).toBe(bell());
  await act(async () =>
    saveUserPreferences(20, { showNotificationBadge: true }),
  );
  expect(badge()).toBe("1");
  await open();
  await act(async () =>
    document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })),
  );
  expect(feed()).toBeNull();
});

it("falls back to recent finance expenses and caps the feed and badge", async () => {
  const expenses = Array.from({ length: 12 }, (_, index) => ({
    id: index + 1,
    description: `Expense ${index + 1}`,
    amount: "150",
    category: "Food",
    status: "Approved",
    expense_date: `2026-11-${String(index + 1).padStart(2, "0")}`,
  }));
  vi.spyOn(financeApi, "expenses").mockResolvedValue(expenses);
  await mount("finance");
  expect(badge()).toBe("9+");
  await open();
  expect(feed().querySelectorAll("li")).toHaveLength(10);
  expect(feed().querySelector("li").textContent).toContain("Expense 12");
  expect(feed().textContent).toContain("Recent expense");
});

it("deduplicates overlapping approval and high-value alerts for admins", async () => {
  vi.spyOn(financeApi, "expenses").mockResolvedValue(createDemoData());
  await mount("khalid", "admin");
  await open();
  expect(
    feed().querySelectorAll('a[href="/manager/expenses/109"]'),
  ).toHaveLength(1);
  expect(feed().querySelectorAll("li")).toHaveLength(6);
});
