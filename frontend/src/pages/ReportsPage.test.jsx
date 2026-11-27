// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { api, request } from "../services/api";
import { financeApi } from "../services/financeApi";
import { CATEGORIES } from "../utils/constants";
import * as csv from "../utils/csvExport";
import { formatMoney } from "../utils/formatters";
import { loadSpendExpenses } from "../utils/spendExpenses";
import ReportsPage from "./ReportsPage";

const auth = vi.hoisted(() => ({
  user: { id: 20, role: "finance" },
  mockMode: true,
}));
vi.mock("../context/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("../services/api", async (importOriginal) => ({
  ...(await importOriginal()),
  request: vi.fn(),
  get USE_MOCK() {
    return auth.mockMode;
  },
}));

const records = [
  {
    id: 31,
    description: "Client meeting",
    employeeName: "Noura",
    department: { id: 1, name: "Operations" },
    category: { name: "Food" },
    amount: "120.50",
    status: "approved",
    expense_date: "2026-10-02",
  },
  {
    id: 32,
    description: "Flight",
    employeeName: "Omar",
    department: { id: 2, name: "Engineering" },
    category: { name: "Travel" },
    amount: "300",
    status: "pending",
    expense_date: "2026-11-03",
  },
  {
    id: 33,
    description: "Duplicate travel",
    employeeName: "Sara",
    department: { id: 1, name: "Operations" },
    category: { name: "Travel" },
    amount: "8500",
    status: "rejected",
    expense_date: "2026-11-04",
  },
];

let host;
let root;
const section = (id) => host.querySelector(`section[aria-labelledby="${id}"]`);
const rows = () => [...section("report-preview").querySelectorAll("tbody tr")];
const kpi = (label) =>
  [...host.querySelectorAll("dt")].find((node) => node.textContent === label)
    .parentElement.textContent;
const button = (label) =>
  [...host.querySelectorAll("button")].find(
    (node) => node.textContent.trim() === label,
  );
const render = () => act(async () => root.render(<ReportsPage />));

async function setFilter(id, value) {
  const control = host.querySelector(`#report-${id}`);
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(control),
    "value",
  ).set;
  await act(async () => {
    setter.call(control, value);
    control.dispatchEvent(
      new Event(id === "search" ? "input" : "change", { bubbles: true }),
    );
  });
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", undefined);
  vi.spyOn(financeApi, "expenses").mockResolvedValue(records);
  auth.user = { id: 20, role: "finance" };
  auth.mockMode = true;
  request.mockReset();
  host = document.body.appendChild(document.createElement("div"));
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

it("excludes rejected amounts from spend, shows accurate KPIs, and renders every category", async () => {
  await render();
  expect(kpi("Total Spend (Excl. Rejected)")).toContain(formatMoney(420.5));
  expect(kpi("Total Spend (Excl. Rejected)")).toContain("2 active requests");
  expect(kpi("Approval Rate")).toContain("50%");
  expect(kpi("Top Category")).toContain("Travel");
  expect(kpi("Top Category")).toContain("71% of spend");
  expect(kpi("Pending Exposure")).toContain(formatMoney(300));
  expect(
    [...section("report-categories").querySelectorAll("tbody tr")].map(
      (row) => row.cells[0].textContent,
    ),
  ).toEqual(CATEGORIES);
  expect(
    [...section("report-departments").querySelectorAll("tbody tr")].map(
      (row) => row.cells[0].textContent,
    ),
  ).toEqual(["Engineering", "Operations"]);
  expect(rows()).toHaveLength(3);
  expect(button("Reset Filters").disabled).toBe(true);
});

it("combines status, category, department, search and month filters and exports the visible rows", async () => {
  const download = vi
    .spyOn(csv, "downloadExpensesCsv")
    .mockImplementation(() => {});
  await render();
  await setFilter("status", "rejected");
  await setFilter("category", "Travel");
  await setFilter("department", "Operations");
  await setFilter("search", "SaRa");
  await setFilter("month", "2026-11");
  expect(rows()).toHaveLength(1);
  expect(rows()[0].textContent).toContain("#33");
  expect(kpi("Total Spend (Excl. Rejected)")).toContain(formatMoney(0));
  expect(kpi("Top Category")).toContain("—");
  await act(async () => button("Export CSV (1)").click());
  expect(download).toHaveBeenCalledWith([
    expect.objectContaining({ id: 33, status: "rejected" }),
  ]);
  await setFilter("month", "2026-10");
  expect(button("Export CSV (0)").disabled).toBe(true);
  expect(host.textContent).toContain("No matching expenses");
  await act(async () => button("Reset Filters").click());
  expect(rows()).toHaveLength(3);
  await setFilter("search", "32");
  expect(rows()).toHaveLength(1);
  expect(rows()[0].textContent).toContain("Flight");
});

it("loads manager results within the account’s department and recovers from an error", async () => {
  auth.user = { id: 8, role: "manager", department_id: 2 };
  const load = vi
    .spyOn(api, "allExpenses")
    .mockRejectedValueOnce(new Error("Try the connection again"))
    .mockResolvedValue(records);
  await render();
  expect(host.querySelector('[role="alert"]').textContent).toContain(
    "Try the connection again",
  );
  expect(button("Export CSV (0)").disabled).toBe(true);
  await act(async () => button("Try again").click());
  expect(load).toHaveBeenCalledWith({ view: "department" });
  expect(financeApi.expenses).not.toHaveBeenCalled();
  expect(rows()).toHaveLength(1);
  expect(rows()[0].textContent).toContain("Flight");
});

it("handles unscoped live data without showing unverifiable employee or department records", async () => {
  auth.mockMode = false;
  const live = {
    expense_id: 91,
    description: "Printer paper",
    category: "Office Supplies",
    status: "Approved",
    expense_date: "2026-11-03",
    amount: "25.00",
  };
  request.mockResolvedValue([live]);
  await expect(loadSpendExpenses({ id: 5, role: "employee" })).resolves.toEqual(
    [],
  );
  await expect(
    loadSpendExpenses({ id: 8, role: "manager", department_id: 2 }),
  ).resolves.toEqual([]);
  await expect(loadSpendExpenses({ id: 20, role: "finance" })).resolves.toEqual(
    [
      expect.objectContaining({
        id: 91,
        category: "Office Supplies",
        status: "approved",
      }),
    ],
  );

  request
    .mockReset()
    .mockResolvedValueOnce({ items: [live], total: 2 })
    .mockResolvedValueOnce({
      items: [{ ...live, expense_id: 92, department_id: 2, requester_id: 5 }],
      total: 2,
    });
  await expect(
    loadSpendExpenses({ id: 8, role: "manager", department_id: 2 }),
  ).resolves.toEqual([
    expect.objectContaining({ id: 92, department: "Department 2" }),
  ]);
  expect(request.mock.calls.map(([url]) => url)).toEqual([
    "/expenses?page=1&size=100",
    "/expenses?page=2&size=100",
  ]);
});
