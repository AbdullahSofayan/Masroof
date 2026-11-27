import { expect, it } from "vitest";
import { buildExpensesCsv, escapeCsvField } from "./csvExport";

it("escapes nullish values, commas, quotes, and line breaks", () => {
  expect(escapeCsvField(null)).toBe("");
  expect(escapeCsvField(undefined)).toBe("");
  expect(escapeCsvField('مصاريف, "April"\nreview')).toBe(
    '"مصاريف, ""April""\nreview"',
  );
  expect(escapeCsvField("a\rb")).toBe('"a\rb"');
});

it.each(["=SUM(A1)", "+cmd", "-5", "@SUM(A1)", "\t =A1"])(
  "neutralizes a formula-like string %j",
  (value) => {
    expect(escapeCsvField(value)).toBe(`'${value}`);
    expect(escapeCsvField(-5)).toBe("-5");
  },
);

it("prefixes a BOM and emits headers and rows from nested, flat, and live fields", () => {
  const csv = buildExpensesCsv([
    {
      id: 2,
      description: "ضيافة",
      requester: { full_name: "سارة" },
      department: { name: "Product" },
      category: { name: "Food" },
      amount: "142.50",
      status: "approved",
      expense_date: "2026-11-12",
    },
    {
      id: 3,
      title: "Team, travel",
      employee: "Khalid",
      department: "Operations",
      category: "Travel",
      amount: -25,
      status: "Rejected",
      createdAt: "2026-11-13",
    },
    {
      expense_id: 4,
      description: "=A1",
      category: "Equipment & Maintenance",
      amount: null,
      status: "Pending",
      expense_date: "2026-11-14",
    },
  ]);
  expect(csv.charCodeAt(0)).toBe(0xfeff);
  expect(csv.slice(1).split("\r\n")).toEqual([
    "ID,Title,Employee,Department,Category,Amount (SAR),Status,Date",
    "2,ضيافة,سارة,Product,Food,142.5,Approved,2026-11-12",
    '3,"Team, travel",Khalid,Operations,Travel,-25,Rejected,2026-11-13',
    "4,'=A1,,,Equipment & Maintenance,,Pending,2026-11-14",
  ]);
});
