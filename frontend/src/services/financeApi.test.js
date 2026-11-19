import { beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { STATUS } from "../utils/constants";
import { today } from "../utils/formatters";
import { DEMO_PASSWORD } from "./mockData";

const storage = new Map();
vi.stubGlobal("localStorage", {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
});
vi.stubGlobal("window", new EventTarget());
const { api } = await import("./api");
const { financeApi, effectiveStatus, normalizeExpense, budgetUsage } =
  await import("./financeApi");
const login = (username = "finance") => api.login(username, DEMO_PASSWORD);
const [YEAR, MONTH] = today().split("-").map(Number);

beforeEach(() => {
  storage.clear();
  api.logout();
});

describe("finance access", () => {
  it("rejects employees and managers", async () => {
    await login("sara");
    await expect(financeApi.dashboard()).rejects.toMatchObject({ status: 403 });
    await login("khalid");
    await expect(
      financeApi.budgets({ year: YEAR, month: MONTH }),
    ).rejects.toMatchObject({ status: 403 });
  });
});

describe("one approval step", () => {
  it("only ever reports Pending, Approved or Rejected", async () => {
    await login();
    const statuses = new Set(
      (await financeApi.expenses()).map((expense) => expense.status),
    );
    expect(
      [...statuses].every((status) =>
        [STATUS.PENDING_MANAGER, STATUS.APPROVED, STATUS.REJECTED].includes(
          status,
        ),
      ),
    ).toBe(true);
  });
  it("treats a manager approval as final", () => {
    expect(effectiveStatus(STATUS.PENDING_FINANCE)).toBe(STATUS.APPROVED);
    expect(effectiveStatus("Approved")).toBe(STATUS.APPROVED);
    expect(effectiveStatus("Rejected")).toBe(STATUS.REJECTED);
    expect(effectiveStatus("Pending")).toBe(STATUS.PENDING_MANAGER);
    expect(effectiveStatus(STATUS.NEEDS_CHANGES)).toBe(STATUS.PENDING_MANAGER);
  });
  it("counts an expense the manager approves in the demo", async () => {
    await login("khalid");
    await api.decide(102, "approve", "");
    await login();
    expect(
      (await financeApi.expenses()).find((expense) => expense.id === 102)
        .status,
    ).toBe(STATUS.APPROVED);
  });
  it("keeps expenses employees created when demo data is refreshed", async () => {
    await login();
    await financeApi.expenses();
    const data = JSON.parse(storage.get("masroof.demo.v1"));
    data.push({
      ...data[0],
      id: 99999,
      requester: { id: 11, full_name: "Omar" },
      description: "mine",
    });
    data.forEach((entry) => {
      if (entry.seed_version) entry.seed_version = 1;
    });
    storage.set("masroof.demo.v1", JSON.stringify(data));
    const expenses = await financeApi.expenses();
    expect(expenses.some((expense) => expense.id === 99999)).toBe(true);
    expect(new Set(expenses.map((expense) => expense.id)).size).toBe(
      expenses.length,
    );
  });
});

describe("backend response shapes", () => {
  it("reads main’s ExpenseResponse", () => {
    const result = normalizeExpense({
      expense_id: 4,
      amount: 250,
      category: "Food",
      description: "Lunch",
      expense_date: "2026-11-10",
      status: "Pending",
    });
    expect(result).toMatchObject({
      id: 4,
      category: { name: "Food" },
      amount: "250",
      status: STATUS.PENDING_MANAGER,
      ai: null,
      warnings: [],
    });
  });
  it("reads the ML contract’s AI view and never needs a score", () => {
    const ai = {
      risk_level: "high",
      reasons: [
        { code: "round_amount", text_en: "Round amount", text_ar: "مبلغ" },
      ],
    };
    expect(
      normalizeExpense({
        id: 1,
        amount: 1,
        category: { id: 1, name: "X" },
        expense_date: "2026-11-01",
        status: "Pending",
        ai,
      }).ai,
    ).toEqual(ai);
  });
});

describe("dashboard and AI summary", () => {
  it("adds up", async () => {
    await login();
    const dashboard = await financeApi.dashboard();
    const byDepartment = dashboard.by_department.reduce(
      (sum, entry) => sum + entry.total,
      0,
    );
    expect(byDepartment).toBeCloseTo(Number(dashboard.approved_total), 1);
  });
  it("matches the ML contract AnomalySummary shape", async () => {
    await login();
    const summary = await financeApi.anomalySummary({
      year: YEAR,
      month: MONTH,
    });
    expect(Object.keys(summary.counts).sort()).toEqual([
      "high",
      "low",
      "medium",
      "not_scored",
    ]);
    summary.by_department.forEach((row) => {
      expect(row.flagged).toBeLessThanOrEqual(row.total);
      expect(row.flagged_percent).toBeCloseTo(
        (row.flagged / row.total) * 100,
        0,
      );
    });
    expect(summary.by_department.map((row) => row.flagged_percent)).toEqual(
      [...summary.by_department.map((row) => row.flagged_percent)].sort(
        (a, b) => b - a,
      ),
    );
    expect(summary.top_reasons.length).toBeLessThanOrEqual(5);
    summary.top_reasons.forEach((item) =>
      expect(item).toEqual(
        expect.objectContaining({
          code: expect.any(String),
          text_en: expect.any(String),
          text_ar: expect.any(String),
          count: expect.any(Number),
        }),
      ),
    );
    expect(JSON.stringify(summary)).not.toContain("anomaly_score");
  });
});

describe("monthly budgets", () => {
  it("creates, prevents duplicates, edits the amount, and deletes", async () => {
    await login();
    const budget = await financeApi.createBudget({
      department_id: 3,
      year: YEAR + 1,
      month: 2,
      amount: "7500",
    });
    expect(budget).toEqual({
      id: expect.any(Number),
      department_id: 3,
      year: YEAR + 1,
      month: 2,
      amount: "7500.00",
    });
    await expect(
      financeApi.createBudget({
        department_id: 3,
        year: YEAR + 1,
        month: 2,
        amount: "100",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      financeApi.createBudget({
        department_id: 3,
        year: YEAR + 1,
        month: 13,
        amount: "100",
      }),
    ).rejects.toThrow(/month/);
    expect((await financeApi.updateBudget(budget.id, "8000.50")).amount).toBe(
      "8000.50",
    );
    await expect(financeApi.updateBudget(budget.id, "-1")).rejects.toThrow(
      /zero or more/,
    );
    await financeApi.deleteBudget(budget.id);
    expect(
      (await financeApi.budgets({ year: YEAR + 1, month: 2 })).some(
        (entry) => entry.id === budget.id,
      ),
    ).toBe(false);
  });
  it("reports usage with the same keys as backend/finance budget_usage()", async () => {
    await login();
    const [budget] = await financeApi.budgets({ year: YEAR, month: MONTH });
    const usage = await financeApi.budgetUsage(budget);
    expect(Object.keys(usage).sort()).toEqual([
      "budget",
      "percent",
      "remaining",
      "spent",
    ]);
    expect(Number(usage.remaining)).toBeCloseTo(
      Number(usage.budget) - Number(usage.spent),
      2,
    );
    expect(budgetUsage(50, 0).percent).toBe(0);
  });
});

describe("category limits", () => {
  it("sets, changes and removes a limit", async () => {
    await login();
    await financeApi.saveLimit(2, "450");
    expect(
      (await financeApi.limits()).find((entry) => entry.category_id === 2),
    ).toMatchObject({ max_amount: "450.00" });
    await financeApi.saveLimit(2, "500.5");
    expect(
      (await financeApi.limits()).filter((entry) => entry.category_id === 2),
    ).toHaveLength(1);
    await financeApi.saveLimit(2, "");
    expect(
      (await financeApi.limits()).some((entry) => entry.category_id === 2),
    ).toBe(false);
    await expect(financeApi.saveLimit(2, "abc")).rejects.toThrow(/limit/);
  });
});

describe("forecast", () => {
  it("returns four Sunday-start weeks after eight weeks of history, plus the baseline", async () => {
    await login();
    const forecast = await financeApi.forecast(1);
    expect(forecast.weeks).toHaveLength(4);
    expect(forecast.history).toHaveLength(8);
    forecast.weeks.forEach((week) =>
      expect(new Date(`${week.week_start}T00:00:00Z`).getUTCDay()).toBe(0),
    );
    expect(forecast.baseline_last_week).toBe(forecast.history.at(-1).actual);
  });
});

describe("QA v2 fixes", () => {
  it("follows backend/finance amount rules", async () => {
    await login();
    expect(
      (
        await financeApi.createBudget({
          department_id: 4,
          year: YEAR + 2,
          month: 1,
          amount: "0",
        })
      ).amount,
    ).toBe("0.00");
    await expect(
      financeApi.createBudget({
        department_id: 4,
        year: YEAR + 2,
        month: 2,
        amount: "12345678901",
      }),
    ).rejects.toThrow(/10 digits/);
    await expect(
      financeApi.createBudget({
        department_id: 4,
        year: YEAR + 2,
        month: 2,
        amount: "10.123",
      }),
    ).rejects.toThrow(/2 decimals/);
    await expect(financeApi.saveLimit(1, "0")).rejects.toThrow(
      /greater than zero/,
    );
  });
  it("does not crash when the backend sends AI reasons as null", async () => {
    const { normalizeExpense: normalize } = await import("./financeApi");
    expect(
      normalize({
        id: 5,
        amount: 1,
        category: "Food",
        expense_date: today(),
        status: "Pending",
        ai: { risk_level: "high", reasons: null },
      }).ai.risk_level,
    ).toBe("high");
  });
});

describe("final contract v0.4.3", () => {
  it("reads the ERD columns risk_level + risk_justification", () => {
    const reasons = [
      {
        code: "large_amount",
        text_en: "Very large amount",
        text_ar: "مبلغ كبير جداً",
      },
    ];
    expect(
      normalizeExpense({
        id: 9,
        amount: 1,
        category: "Travel",
        expense_date: today(),
        status: "Pending",
        risk_level: "medium",
        risk_justification: reasons,
      }).ai,
    ).toEqual({ risk_level: "medium", reasons });
    expect(
      normalizeExpense({
        id: 9,
        amount: 1,
        category: "Travel",
        expense_date: today(),
        status: "Pending",
        risk_level: null,
      }).ai,
    ).toBeNull();
  });
  it("uses only the 10 final reason codes with the final texts", async () => {
    const { AI_REASONS } = await import("./financeMock");
    expect(Object.keys(AI_REASONS)).toHaveLength(10);
    expect(AI_REASONS.amount_high_for_department[0]).toBe(
      "Amount is much higher than usual for this department in this category",
    );
    await login();
    const summary = await financeApi.anomalySummary({
      year: YEAR,
      month: MONTH,
    });
    summary.top_reasons.forEach((item) =>
      expect(AI_REASONS[item.code][0]).toBe(item.text_en),
    );
  });
});
