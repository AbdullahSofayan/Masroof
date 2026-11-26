import { expect, it } from "vitest";
import { migrateDemoData } from "./demoMigration";
import { STATUS } from "../utils/constants";

it("preserves saved request contents while migrating legacy statuses and categories", () => {
  const original = [
    "pending_manager",
    "needs_changes",
    "pending_finance",
    "approved",
    "rejected",
  ].map((status, index) => ({
    id: index + 1,
    status,
    category: { id: index + 1, name: "Old category" },
    description: "Saved request",
    attachment_url: "stored-receipt",
    approvals: [],
  }));
  const migrated = migrateDemoData(original);
  expect(migrated.map((entry) => entry.status)).toEqual([
    STATUS.PENDING,
    STATUS.PENDING,
    STATUS.APPROVED,
    STATUS.APPROVED,
    STATUS.REJECTED,
  ]);
  expect(migrated.map((entry) => entry.category.name)).toEqual([
    "Food",
    "Office Supplies",
    "Travel",
    "IT & Telecom",
    "Equipment & Maintenance",
  ]);
  expect(
    migrated.every(
      (entry) =>
        entry.description === "Saved request" &&
        entry.attachment_url === "stored-receipt",
    ),
  ).toBe(true);
  expect(original[0].category.name).toBe("Old category");
});
