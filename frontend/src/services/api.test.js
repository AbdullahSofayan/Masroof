import { beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import {
  CURRENCY,
  DECISION,
  MAX_FILE_SIZE,
  STATUS,
  STORAGE_KEYS,
  validateReceipt,
} from "../utils/constants";
import { DEMO_PASSWORD } from "./mockData";

const storage = new Map();
vi.stubGlobal("localStorage", {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
});
vi.stubGlobal("window", new EventTarget());
const { api, getToken } = await import("./api");
const login = (username = "sara") => api.login(username, DEMO_PASSWORD);
const payload = {
  amount: "245.50",
  category_id: 3,
  expense_date: "2026-11-15",
  description: "زيارة عمل إلى مقر العميل",
};

beforeEach(() => {
  storage.clear();
  api.logout();
});
describe("authentication and permission scoping", () => {
  it("requires valid credentials, returns the profile, and clears the session on logout", async () => {
    await expect(api.login("sara", "incorrect")).rejects.toMatchObject({
      status: 401,
    });
    const user = await login();
    expect(user.full_name).toBe("سارة العتيبي");
    expect(getToken()).toBeTruthy();
    api.logout();
    expect(getToken()).toBeNull();
    await expect(api.me()).rejects.toMatchObject({ status: 401 });
  });
  it("only exposes an employee’s own expenses and denies department access", async () => {
    await login();
    const result = await api.listExpenses({ view: "own", page: 1, size: 3 });
    expect(result).toMatchObject({ page: 1, size: 3 });
    expect(result.total).toBeGreaterThan(3);
    expect(result.items).toHaveLength(3);
    expect(result.items.every((expense) => expense.requester.id === 5)).toBe(
      true,
    );
    await expect(api.getExpense(102)).rejects.toMatchObject({ status: 403 });
    await expect(
      api.listExpenses({ view: "department" }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("keeps managers’ employee view personal while showing their department queue", async () => {
    await login("khalid");
    const own = await api.allExpenses({ view: "own" });
    expect(own.every((entry) => entry.requester.id === 8)).toBe(true);
    const queue = await api.listExpenses({ status: STATUS.PENDING_MANAGER });
    expect(
      queue.items.every(
        (entry) =>
          entry.status === STATUS.PENDING_MANAGER && entry.department.id === 2,
      ),
    ).toBe(true);
    expect(queue.total).toBe(5);
    await expect(
      api.updateExpense(101, { description: "Manager edit" }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("denies cross-department review even for a manager", async () => {
    await login("khalid");
    const expense = await api.getExpense(101);
    storage.set(
      STORAGE_KEYS.DATA,
      JSON.stringify([{ ...expense, department: { id: 9, name: "Sales" } }]),
    );
    await expect(api.decide(101, DECISION.APPROVE)).rejects.toMatchObject({
      status: 403,
    });
  });
});
describe("employee submission and receipts", () => {
  it("creates, partially updates, uploads, opens and deletes a request", async () => {
    await login();
    const created = await api.createExpense(payload);
    expect(created).toMatchObject({
      status: STATUS.PENDING_MANAGER,
      amount: "245.50",
      currency: CURRENCY,
      ai_analysis: null,
    });
    const edited = await api.updateExpense(created.id, {
      description: "Updated business purpose",
    });
    expect(edited.description).toBe("Updated business purpose");
    expect(edited.amount).toBe("245.50");
    const file = new File(["demo receipt"], "receipt.png", {
      type: "image/png",
    });
    const uploaded = await api.uploadReceipt(created.id, file);
    expect(uploaded.attachment_name).toBe("receipt.png");
    const receipt = await api.receipt(uploaded);
    expect(receipt.type).toBe("image/png");
    expect(receipt.url).toMatch(/^blob:/);
    URL.revokeObjectURL(receipt.url);
    await api.deleteExpense(created.id);
    await expect(api.getExpense(created.id)).rejects.toMatchObject({
      status: 404,
    });
  });
  it("rejects invalid amount, missing description and invalid dates", async () => {
    await login();
    for (const update of [
      { amount: "0" },
      { amount: "-1" },
      { amount: "NaN" },
      { amount: "1.001" },
      { description: "  " },
      { expense_date: "2099-01-01" },
      { expense_date: "2026-02-30" },
    ]) {
      await expect(
        api.createExpense({ ...payload, ...update }),
      ).rejects.toThrow();
    }
  });
  it("validates the single receipt type, nonempty content and size limit", () => {
    expect(validateReceipt(null)).toBeTruthy();
    expect(validateReceipt({ type: "image/svg+xml", size: 20 })).toBeTruthy();
    expect(validateReceipt({ type: "application/pdf", size: 0 })).toBeTruthy();
    expect(
      validateReceipt({ type: "image/png", size: MAX_FILE_SIZE + 1 }),
    ).toBeTruthy();
    expect(
      validateReceipt({ type: "application/pdf", size: MAX_FILE_SIZE }),
    ).toBe("");
  });
  it("does not allow changing or deleting approved or finance-pending requests", async () => {
    await login();
    await expect(api.updateExpense(105, payload)).rejects.toMatchObject({
      status: 409,
    });
    await expect(api.deleteExpense(106)).rejects.toMatchObject({ status: 409 });
    await expect(api.resubmitExpense(101)).rejects.toMatchObject({
      status: 409,
    });
  });
});
describe("manager decisions and append-only approval history", () => {
  it.each([DECISION.REJECT, DECISION.REQUEST_CHANGES])(
    "requires a nonblank note for %s",
    async (decision) => {
      await login("khalid");
      await expect(api.decide(101, decision, "  ")).rejects.toThrow(/note/);
      expect((await api.getExpense(101)).status).toBe(STATUS.PENDING_MANAGER);
    },
  );
  it("approves once, transfers to Finance and preserves existing history", async () => {
    await login("khalid");
    const before = await api.getExpense(101);
    const after = await api.decide(
      101,
      DECISION.APPROVE,
      "  Receipt verified.  ",
    );
    expect(after.status).toBe(STATUS.PENDING_FINANCE);
    expect(after.approvals.slice(0, before.approvals.length)).toEqual(
      before.approvals,
    );
    expect(after.approvals.at(-1)).toMatchObject({
      decision: STATUS.PENDING_FINANCE,
      note: "Receipt verified.",
    });
    await expect(
      api.decide(101, DECISION.REJECT, "Already reviewed"),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("supports the full request-changes, edit, resubmit and rejection workflow across sessions", async () => {
    await login("khalid");
    await api.decide(101, DECISION.REQUEST_CHANGES, "يرجى توضيح تفاصيل الرحلة");
    await login();
    expect((await api.getExpense(101)).status).toBe(STATUS.NEEDS_CHANGES);
    await api.updateExpense(101, {
      description: "اجتماع عمل مع العميل في جدة",
    });
    const returned = await api.resubmitExpense(101);
    expect(returned.status).toBe(STATUS.PENDING_MANAGER);
    expect(returned.ai_analysis).toBeNull();
    expect(returned.approvals).toHaveLength(3);
    await login("khalid");
    const rejected = await api.decide(101, DECISION.REJECT, "الطلب مكرر");
    expect(rejected.status).toBe(STATUS.REJECTED);
    expect(rejected.approvals).toHaveLength(4);
    await login();
    await expect(api.updateExpense(101, payload)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("prevents an employee from deciding and a manager from approving their own request", async () => {
    await login();
    await expect(api.decide(101, DECISION.APPROVE)).rejects.toMatchObject({
      status: 403,
    });
    await login("khalid");
    await expect(api.decide(112, DECISION.APPROVE)).rejects.toMatchObject({
      status: 403,
    });
  });
});
