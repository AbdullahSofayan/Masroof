// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApprovalProgressBar, { approvalStage } from "./ApprovalProgressBar";
import BudgetProgressBar from "./BudgetProgressBar";
import ReceiptScanPreview from "./ReceiptScanPreview";
import SpendSparkline from "./SpendSparkline";
import { canMeasureSvgPath } from "./useFintechMotion";
import { sparklineGeometry, weeklyApprovedSpend } from "./spendData";
import ExpenseTable from "../ExpenseTable";
import StatusBadge from "../StatusBadge";
import AddExpensePage from "../../pages/employee/AddExpensePage";
import MyExpensesPage from "../../pages/employee/MyExpensesPage";
import ManagerDashboard from "../../pages/manager/ManagerDashboard";
import ExpenseReviewPage from "../../pages/manager/ExpenseReviewPage";
import { api } from "../../services/api";
import {
  createDemoData,
  demoCategories,
  demoUsers,
} from "../../services/mockData";
import { DECISION, STATUS } from "../../utils/constants";

const state = vi.hoisted(() => ({ user: null }));
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ user: state.user }),
}));
vi.mock("../../context/NoticeContext", () => ({ useNotice: () => vi.fn() }));
vi.mock("../ReceiptViewer", () => ({
  default: () => <div>Receipt preview</div>,
}));

const browserRequestFrame = window.requestAnimationFrame.bind(window);
const browserCancelFrame = window.cancelAnimationFrame.bind(window);
let root;
let host;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", undefined);
  vi.stubGlobal("cancelAnimationFrame", undefined);
  vi.stubGlobal("IntersectionObserver", undefined);
  vi.stubGlobal("ResizeObserver", undefined);
  vi.stubGlobal("matchMedia", undefined);
  state.user = demoUsers.find((user) => user.username === "sara");
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
const render = async (element) =>
  act(async () => {
    root.render(element);
  });
const router = (element, path = "/") => (
  <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>
);
const button = (text) =>
  [...host.querySelectorAll("button")].find(
    (node) =>
      node.getAttribute("aria-label") === text ||
      node.textContent.trim() === text,
  );
async function setInput(node, value) {
  const setter = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(node),
    "value",
  ).set;
  await act(async () => {
    setter.call(node, value);
    node.dispatchEvent(
      new Event(node.tagName === "SELECT" ? "change" : "input", {
        bubbles: true,
      }),
    );
  });
}
function enableFrames({ reduced = false, layout = false } = {}) {
  vi.stubGlobal("requestAnimationFrame", browserRequestFrame);
  vi.stubGlobal("cancelAnimationFrame", browserCancelFrame);
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: reduced,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
  if (layout) {
    class Observer {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", Observer);
    vi.stubGlobal("ResizeObserver", Observer);
  }
}

describe("financial data and progress", () => {
  it.each([
    [74.99, "bg-emerald-500"],
    [75, "bg-amber-500"],
    [90, "bg-amber-500"],
    [90.01, "bg-rose-500"],
    [150, "bg-rose-500"],
  ])("uses the correct budget threshold for %s%%", async (spent, color) => {
    await render(<BudgetProgressBar spent={spent} budget={100} />);
    const track = host.querySelector('[role="progressbar"]');
    expect(track.firstElementChild.classList.contains(color)).toBe(true);
    expect(track.firstElementChild.style.width).toBe(
      `${Math.min(100, spent)}%`,
    );
    expect(Number(track.getAttribute("aria-valuenow"))).toBe(
      Math.min(100, spent),
    );
  });
  it("does not invent a utilization when budget data is unavailable or invalid", async () => {
    await render(<BudgetProgressBar spent={1450} budget={null} />);
    expect(host.textContent).toContain("Budget unavailable");
    expect(
      host.querySelector('[role="progressbar"]').hasAttribute("aria-valuenow"),
    ).toBe(false);
    await render(<BudgetProgressBar spent={NaN} budget={0} />);
    expect(host.innerHTML).not.toMatch(/NaN|Infinity/);
  });
  it("shows one manager review followed by a final decision", async () => {
    expect(approvalStage(STATUS.PENDING)).toBe(1);
    expect(approvalStage(STATUS.APPROVED)).toBe(2);
    expect(approvalStage(STATUS.REJECTED)).toBe(2);
    for (const [status, label] of [
      [STATUS.PENDING, "Pending"],
      [STATUS.APPROVED, "Approved"],
      [STATUS.REJECTED, "Rejected"],
    ]) {
      await render(<ApprovalProgressBar status={status} />);
      expect(host.querySelector('[aria-current="step"]').textContent).toContain(
        label,
      );
      expect(host.querySelectorAll("li")).toHaveLength(3);
      expect(host.textContent).not.toContain("Finance Review");
    }
  });
  it("derives six weekly buckets from approved expense dates, excluding pending and future records", () => {
    const expense = (date, amount, status = STATUS.APPROVED) => ({
      expense_date: date,
      amount,
      status,
    });
    const weeks = weeklyApprovedSpend(
      [
        expense("2026-11-09", "100.10"),
        expense("2026-11-15", "20.20"),
        expense("2026-11-16", "50"),
        expense("2026-11-17", "999", STATUS.PENDING),
        expense("2026-11-18", "999"),
        expense("2026-09-01", "999"),
        expense("invalid", "999"),
      ],
      "2026-11-17",
    );
    expect(weeks).toHaveLength(6);
    expect(weeks.at(-2)).toEqual({ date: "2026-11-09", amount: 120.3 });
    expect(weeks.at(-1)).toEqual({ date: "2026-11-16", amount: 50 });
    expect(weeks.reduce((sum, week) => sum + week.amount, 0)).toBe(170.3);
    expect(weeklyApprovedSpend([], "invalid")).toEqual([]);
  });
  it("produces finite empty bars and unique accessible chart IDs without SVG measurement", async () => {
    expect(sparklineGeometry([]).line).toBe("");
    expect(sparklineGeometry([0, 0, NaN]).line).not.toMatch(/NaN|Infinity/);
    await render(
      <>
        <SpendSparkline expenses={[]} endDate="2026-11-17" />
        <SpendSparkline expenses={createDemoData()} endDate="2026-11-17" />
      </>,
    );
    const ids = [...host.querySelectorAll("svg > title")].map(
      (node) => node.id,
    );
    expect(new Set(ids).size).toBe(2);
    expect(host.querySelector("svg").getAttribute("viewBox")).toBe(
      "0 0 600 155",
    );
    expect(host.querySelectorAll("[data-spend-bar]")).toHaveLength(12);
    expect(
      host.querySelectorAll('[data-spend-bar][fill="#1F5C3B"]'),
    ).toHaveLength(2);
    expect(
      host.querySelectorAll('[data-spend-bar][fill="#DFDFDA"]'),
    ).toHaveLength(10);
    expect(
      [
        ...host.querySelectorAll("svg")[0].querySelectorAll("[data-spend-bar]"),
      ].map((bar) => Number(bar.getAttribute("height"))),
    ).toEqual([0, 0, 0, 0, 0, 4]);
    expect(host.innerHTML).not.toMatch(/NaN|Infinity/);
  });
  it("handles a throwing SVG geometry implementation gracefully", async () => {
    enableFrames();
    const original = Object.getOwnPropertyDescriptor(
      SVGElement.prototype,
      "getTotalLength",
    );
    Object.defineProperty(SVGElement.prototype, "getTotalLength", {
      configurable: true,
      value: () => {
        throw new Error("No SVG geometry");
      },
    });
    try {
      expect(canMeasureSvgPath()).toBe(false);
      await render(
        <SpendSparkline expenses={createDemoData()} endDate="2026-11-17" />,
      );
      expect(host.querySelectorAll("[data-spend-bar]")).toHaveLength(6);
    } finally {
      if (original)
        Object.defineProperty(SVGElement.prototype, "getTotalLength", original);
      else delete SVGElement.prototype.getTotalLength;
    }
  });
});

describe("receipts, motion preferences and filtering", () => {
  it("renders immediate final progress, statuses, bars and rows for reduced motion", async () => {
    enableFrames({ reduced: true, layout: true });
    const expenses = createDemoData().slice(0, 2);
    await render(
      router(
        <>
          <BudgetProgressBar spent={75} budget={100} />
          <ApprovalProgressBar status={STATUS.APPROVED} />
          <StatusBadge status={STATUS.APPROVED} />
          <SpendSparkline expenses={createDemoData()} endDate="2026-11-17" />
          <ExpenseTable expenses={expenses} onSelect={vi.fn()} />
        </>,
      ),
    );
    expect(
      host.querySelector('[role="progressbar"]').firstElementChild.style.width,
    ).toBe("75%");
    expect(host.querySelector('[aria-current="step"]').textContent).toContain(
      "Approved",
    );
    expect(host.querySelector("[data-status]").textContent).toBe("Approved");
    const bars = [...host.querySelectorAll("[data-spend-bar]")];
    expect(bars).toHaveLength(6);
    expect(
      Math.max(...bars.map((bar) => Number(bar.getAttribute("height")))),
    ).toBe(125);
    expect(
      bars.every(
        (bar) =>
          Number(bar.getAttribute("y")) + Number(bar.getAttribute("height")) ===
          140,
      ),
    ).toBe(true);
    expect(host.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(host.querySelectorAll("[data-projection-id]")).toHaveLength(0);
  });

  it("immediately confirms a PDF for reduced motion and revokes its object URL on replacement/unmount", async () => {
    enableFrames({ reduced: true });
    const create = vi.fn((file) => `blob:${file.name}`);
    const revoke = vi.fn();
    const BrowserURL = URL;
    vi.stubGlobal(
      "URL",
      class extends BrowserURL {
        static createObjectURL = create;
        static revokeObjectURL = revoke;
      },
    );
    const pdf = new File(["pdf"], "invoice.pdf", { type: "application/pdf" });
    await render(<ReceiptScanPreview file={pdf} />);
    expect(host.querySelector("[data-receipt-scan]")).toBeNull();
    expect(host.textContent).toContain(
      "Receipt captured • Ready for submission",
    );
    expect(host.querySelector("object").type).toBe("application/pdf");
    await render(
      <ReceiptScanPreview
        file={new File(["image"], "فاتورة.png", { type: "image/png" })}
      />,
    );
    expect(revoke).toHaveBeenCalledWith("blob:invoice.pdf");
    expect(host.querySelector("img")).not.toBeNull();
    await render(null);
    expect(revoke).toHaveBeenCalledWith("blob:فاتورة.png");
  });
  it("runs one receipt sweep, then restarts only when the receipt is replaced", async () => {
    enableFrames();
    const receipt = new File(["png"], "receipt.png", { type: "image/png" });
    await render(<ReceiptScanPreview file={receipt} />);
    expect(host.querySelectorAll("[data-receipt-scan]")).toHaveLength(1);
    expect(host.textContent).not.toContain("Receipt captured");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1400));
    });
    expect(host.querySelector("[data-receipt-scan]")).toBeNull();
    expect(host.textContent).toContain("Receipt captured");
    await render(<ReceiptScanPreview file={receipt} />);
    expect(host.querySelector("[data-receipt-scan]")).toBeNull();
    await render(
      <ReceiptScanPreview
        file={new File(["replacement"], "receipt.png", { type: "image/png" })}
      />,
    );
    expect(host.querySelectorAll("[data-receipt-scan]")).toHaveLength(1);
    expect(host.textContent).not.toContain("Receipt captured");
  });
  it("preserves table semantics and removes exited rows when layout animations are enabled", async () => {
    enableFrames({ layout: true });
    const expenses = createDemoData().slice(0, 3);
    await render(
      router(<ExpenseTable expenses={expenses} onSelect={vi.fn()} />),
    );
    const table = host.querySelector("table");
    await render(
      router(<ExpenseTable expenses={expenses.slice(1)} onSelect={vi.fn()} />),
    );
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(host.querySelector("table")).toBe(table);
    expect(
      [...host.querySelector("tbody").children].every(
        (node) => node.tagName === "TR",
      ),
    ).toBe(true);
    expect(host.querySelectorAll("tbody tr")).toHaveLength(2);
    expect(
      [...host.querySelectorAll("tbody tr")].every(
        (row) => row.children.length === 6,
      ),
    ).toBe(true);
    expect(host.querySelector('p[dir="auto"]').children.length).toBe(0);
  });
  it("keeps the employee table mounted while a status filter is loading", async () => {
    const expenses = createDemoData().filter(
      (entry) => entry.requester.id === state.user.id,
    );
    let finish;
    vi.spyOn(api, "listExpenses")
      .mockResolvedValueOnce({
        items: expenses.slice(0, 6),
        total: expenses.length,
        page: 1,
        size: 6,
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      );
    await render(router(<MyExpensesPage />));
    const table = host.querySelector("table");
    await act(async () => button("Pending").click());
    expect(host.querySelector("table")).toBe(table);
    expect(host.textContent).toContain("Updating expenses");
    const filtered = expenses.filter(
      (entry) => entry.status === STATUS.PENDING,
    );
    await act(async () =>
      finish({ items: filtered, total: filtered.length, page: 1, size: 6 }),
    );
    expect(host.querySelector("table")).toBe(table);
    expect(host.querySelectorAll("tbody tr")).toHaveLength(filtered.length);
    expect(button("Pending").getAttribute("aria-pressed")).toBe("true");
  });
  it("shows the manager demo budget and data-derived trend, with all workflow filters", async () => {
    state.user = demoUsers.find((user) => user.username === "khalid");
    vi.spyOn(api, "allExpenses").mockResolvedValue(createDemoData());
    await render(router(<ManagerDashboard />));
    expect(host.textContent).toContain("Demo department allocation");
    expect(host.textContent).toContain("Spend velocity");
    expect(host.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(host.querySelector('svg[role="img"]')).not.toBeNull();
    await act(async () => button("Approved").click());
    expect(
      [...host.querySelectorAll("tbody [data-status]")].every(
        (node) => node.dataset.status === STATUS.APPROVED,
      ),
    ).toBe(true);
    expect(host.querySelector("canvas")).toBeNull();
  });
});

describe("workflow and upload integrations", () => {
  it.each([
    [DECISION.APPROVE, STATUS.APPROVED, "Approved"],
    [DECISION.REJECT, STATUS.REJECTED, "Rejected"],
  ])(
    "keeps detail elements mounted for the server-confirmed %s status",
    async (decision, status, stage) => {
      state.user = demoUsers.find((user) => user.username === "khalid");
      const expense = createDemoData()[0];
      vi.spyOn(api, "getExpense").mockResolvedValue(expense);
      vi.spyOn(api, "decide").mockResolvedValue({
        ...expense,
        status,
        approvals: [
          ...expense.approvals,
          {
            id: 900,
            actor_name: state.user.full_name,
            decision: status,
            note: "تمت المراجعة",
            created_at: new Date().toISOString(),
          },
        ],
      });
      await render(
        router(
          <Routes>
            <Route
              path="/manager/expenses/:id"
              element={<ExpenseReviewPage />}
            />
          </Routes>,
          "/manager/expenses/101",
        ),
      );
      const badge = host.querySelector("[data-status]");
      const progress = host.querySelector('[aria-label="Approval progress"]');
      await setInput(host.querySelector("#manager-note"), "تمت المراجعة");
      await act(async () =>
        button(
          decision === DECISION.APPROVE ? "Approve expense" : "Reject expense",
        ).click(),
      );
      expect(host.querySelector("[data-status]")).toBe(badge);
      expect(badge.dataset.status).toBe(status);
      expect(host.querySelector('[aria-label="Approval progress"]')).toBe(
        progress,
      );
      expect(
        progress.querySelector('[aria-current="step"]').textContent,
      ).toContain(stage);
      expect(host.textContent).toContain("تمت المراجعة");
    },
  );
  it("animates a status label to the current status without remounting the pill", async () => {
    enableFrames();
    await render(<StatusBadge status={STATUS.PENDING} />);
    const badge = host.querySelector("[data-status]");
    await render(<StatusBadge status={STATUS.APPROVED} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 350));
    });
    expect(host.querySelector("[data-status]")).toBe(badge);
    expect(badge.textContent).toBe("Approved");
  });
  it("accepts a dropped receipt, previews it and submits through the existing API calls", async () => {
    vi.spyOn(api, "categories").mockResolvedValue(demoCategories);
    const expense = { ...createDemoData()[0], id: 900 };
    const create = vi.spyOn(api, "createExpense").mockResolvedValue(expense);
    const upload = vi.spyOn(api, "uploadReceipt").mockResolvedValue(expense);
    await render(
      router(
        <Routes>
          <Route path="/employee/expenses/new" element={<AddExpensePage />} />
          <Route
            path="/employee/expenses"
            element={<p>Submission complete</p>}
          />
        </Routes>,
        "/employee/expenses/new",
      ),
    );
    await setInput(host.querySelector("#amount"), "245.50");
    await setInput(host.querySelector("#category_id"), "3");
    await setInput(
      host.querySelector("#description"),
      "زيارة عمل إلى مقر العميل",
    );
    const file = new File(["receipt"], "receipt.pdf", {
      type: "application/pdf",
    });
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.defineProperty(drop, "dataTransfer", { value: { files: [file] } });
    await act(async () =>
      host.querySelector(".upload-zone").dispatchEvent(drop),
    );
    expect(host.textContent).toContain(
      "Receipt captured • Ready for submission",
    );
    await act(async () => button("Submit expense").click());
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: "245.50",
        category_id: 3,
        description: "زيارة عمل إلى مقر العميل",
      }),
    );
    expect(upload).toHaveBeenCalledWith(900, file);
    expect(host.textContent).toContain("Submission complete");
  });
});
