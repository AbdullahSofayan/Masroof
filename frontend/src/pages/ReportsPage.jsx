import { Download, Search } from "lucide-react";
import { useState } from "react";
import StatusBadge from "../components/StatusBadge";
import { EmptyState, ErrorBox, PageHeading, Spinner } from "../components/UI";
import { useAuth } from "../context/AuthContext";
import { CATEGORIES, STATUS, STATUS_META } from "../utils/constants";
import { downloadExpensesCsv } from "../utils/csvExport";
import { formatDate, formatMoney } from "../utils/formatters";
import { loadSpendExpenses } from "../utils/spendExpenses";
import { useAsync } from "../utils/useAsync";

const EMPTY_FILTERS = {
  query: "",
  status: "",
  category: "",
  department: "",
  month: "",
};
const REPORT_NUMBERS = new Intl.NumberFormat("en-SA", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const CATEGORY_COLUMNS = [
  "Category",
  "Requests",
  "Approved (SAR)",
  "Pending (SAR)",
  "Total Spend (SAR)",
  "Share",
];
const DEPARTMENT_COLUMNS = [
  "Department",
  "Requests",
  "Approved (SAR)",
  "Pending (SAR)",
  "Rejected",
  "Share (%)",
];
const EXPENSE_COLUMNS = [
  "ID",
  "Title",
  "Employee",
  "Department",
  "Category",
  "Amount",
  "Status",
  "Date",
];

const monthOf = ({ date }) =>
  date.match(/^\d{4}-(?:0[1-9]|1[0-2])/u)?.[0] || "";
const percent = (part, whole) =>
  whole > 0 ? Math.round((part / whole) * 100) : 0;
const uniqueValues = (values) => [...new Set(values.filter(Boolean))];
const byName = (a, b) => a.localeCompare(b);

function summarize(expenses) {
  const totals = {
    requests: 0,
    approved: 0,
    approvedCents: 0,
    pending: 0,
    pendingCents: 0,
    rejected: 0,
  };
  for (const { status, amount } of expenses) {
    totals.requests += 1;
    totals[status] += 1;
    if (status !== STATUS.REJECTED)
      totals[`${status}Cents`] += Math.round((amount ?? 0) * 100);
  }
  return { ...totals, spendCents: totals.approvedCents + totals.pendingCents };
}

function breakdown(expenses, key, names) {
  const groups = new Map(names.map((name) => [name, []]));
  for (const expense of expenses) groups.get(expense[key])?.push(expense);
  return [...groups].map(([name, items]) => ({ name, ...summarize(items) }));
}

function filterExpenses(expenses, filters) {
  const query = filters.query.trim().toLowerCase();
  return expenses.filter(
    (expense) =>
      (!query ||
        [expense.title, expense.employeeName, String(expense.id)].some(
          (value) => value.toLowerCase().includes(query),
        )) &&
      (!filters.status || expense.status === filters.status) &&
      (!filters.category || expense.category === filters.category) &&
      (!filters.department || expense.department === filters.department) &&
      (!filters.month || monthOf(expense) === filters.month),
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
  allLabel = "All",
}) {
  return (
    <div className="min-w-0">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <select
        className="input"
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">{allLabel}</option>
        {options.map(([key, text]) => (
          <option key={key} value={key}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function ReportFilters({ filters, onChange, reset, expenses }) {
  const departments = uniqueValues(
    expenses.map(({ department }) => department),
  ).sort(byName);
  const months = uniqueValues(expenses.map(monthOf)).sort().reverse();
  const sameLabel = (keys) => keys.map((key) => [key, key]);
  return (
    <section className="card mb-6 p-5 sm:p-6" aria-labelledby="report-filters">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="report-filters" className="text-base font-semibold">
          Filters
        </h2>
        <button
          className="btn-secondary"
          type="button"
          disabled={!Object.values(filters).some(Boolean)}
          onClick={reset}
        >
          Reset Filters
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <div className="min-w-0 sm:col-span-2">
          <label className="field-label" htmlFor="report-search">
            Search expenses
          </label>
          <div className="relative">
            <Search
              size={16}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-zinc-500"
            />
            <input
              className="input pl-9"
              id="report-search"
              type="search"
              placeholder="Title, employee, or expense ID"
              value={filters.query}
              onChange={(event) => onChange("query", event.target.value)}
            />
          </div>
        </div>
        <FilterSelect
          id="report-status"
          label="Status"
          value={filters.status}
          onChange={(value) => onChange("status", value)}
          options={Object.entries(STATUS_META).map(([key, { label }]) => [
            key,
            label,
          ])}
        />
        <FilterSelect
          id="report-category"
          label="Category"
          value={filters.category}
          onChange={(value) => onChange("category", value)}
          options={sameLabel(CATEGORIES)}
        />
        <FilterSelect
          id="report-department"
          label="Department"
          value={filters.department}
          onChange={(value) => onChange("department", value)}
          options={sameLabel(departments)}
        />
        <FilterSelect
          id="report-month"
          label="Month"
          value={filters.month}
          onChange={(value) => onChange("month", value)}
          options={sameLabel(months)}
          allLabel="All Time"
        />
      </div>
    </section>
  );
}

function Kpi({ title, value, detail }) {
  return (
    <div className="card min-w-0 px-5 py-5 sm:p-6">
      <dt className="text-sm font-medium text-zinc-600">{title}</dt>
      <dd className="mt-2 text-xl font-semibold wrap-anywhere tracking-tight tabular-nums text-zinc-900">
        {value}
      </dd>
      <dd className="mt-2 text-xs leading-5 text-zinc-600">{detail}</dd>
    </div>
  );
}

function ReportTable({ id, title, columns, children, preview = false, empty }) {
  return (
    <section className="card min-w-0 overflow-hidden" aria-labelledby={id}>
      <header className="card-heading">
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
      </header>
      {empty || (
        <div
          tabIndex={0}
          role="region"
          aria-labelledby={id}
          className={`overflow-auto focus-visible:-outline-offset-2 focus-visible:outline-2 focus-visible:outline-emerald-600 ${preview ? "max-h-[32rem]" : ""}`}
        >
          <table
            className={`expense-table tabular-nums ${preview ? "" : "[&_td]:px-3 [&_th]:px-3 [&_th]:whitespace-normal"}`}
          >
            <thead className={preview ? "sticky top-0 bg-white" : undefined}>
              <tr>
                {columns.map((column) => (
                  <th key={column} scope="col">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{children}</tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BreakdownRows({ rows, total, showCategoryShare }) {
  return rows.map((row) => {
    const share = percent(row.spendCents, total);
    return (
      <tr key={row.name}>
        <td className="font-medium" dir="auto">
          {row.name || "Unassigned"}
        </td>
        <td>{row.requests}</td>
        <td className="whitespace-nowrap">
          {REPORT_NUMBERS.format(row.approvedCents / 100)}
        </td>
        <td className="whitespace-nowrap">
          {REPORT_NUMBERS.format(row.pendingCents / 100)}
        </td>
        <td className="whitespace-nowrap">
          {showCategoryShare
            ? REPORT_NUMBERS.format(row.spendCents / 100)
            : row.rejected}
        </td>
        <td>
          {share}%
          {showCategoryShare && (
            <div
              aria-hidden="true"
              className="mt-1.5 h-1.5 w-14 overflow-hidden rounded-full bg-emerald-100"
            >
              <div
                className="h-full rounded-full bg-emerald-600"
                style={{ width: `${share}%` }}
              />
            </div>
          )}
        </td>
      </tr>
    );
  });
}

export default function ReportsPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(
    () => loadSpendExpenses(user),
    [user],
  );
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const filtered = loading || error ? [] : filterExpenses(data || [], filters);
  const totals = summarize(filtered);
  const categories = breakdown(filtered, "category", CATEGORIES);
  const departments = breakdown(filtered, "department", [
    ...new Set(filtered.map(({ department }) => department)),
  ]).sort((a, b) => b.spendCents - a.spendCents || byName(a.name, b.name));
  const topCategory = categories.reduce((top, row) =>
    row.spendCents > top.spendCents ? row : top,
  );

  return (
    <>
      <PageHeading
        title="Reports & Analytics"
        description={
          user.role === "manager"
            ? "Analyze your department’s expenses and export the filtered records."
            : "Analyze company-wide expenses and export the filtered records."
        }
        action={
          <button
            className="btn-primary"
            type="button"
            disabled={!filtered.length}
            onClick={() => downloadExpensesCsv(filtered)}
          >
            <Download size={17} aria-hidden="true" /> Export CSV (
            {filtered.length})
          </button>
        }
      />
      {loading ? (
        <Spinner label="Loading expense reports…" />
      ) : error ? (
        <ErrorBox message={error} retry={reload} />
      ) : (
        <>
          <ReportFilters
            filters={filters}
            expenses={data || []}
            reset={() => setFilters(EMPTY_FILTERS)}
            onChange={(key, value) =>
              setFilters((previous) => ({ ...previous, [key]: value }))
            }
          />
          <dl className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi
              title="Total Spend (Excl. Rejected)"
              value={formatMoney(totals.spendCents / 100)}
              detail={`${totals.approved + totals.pending} active requests`}
            />
            <Kpi
              title="Approval Rate"
              value={`${percent(totals.approved, totals.approved + totals.rejected)}%`}
              detail={`${totals.approved} approved · ${totals.rejected} rejected`}
            />
            <Kpi
              title="Top Category"
              value={totals.spendCents ? topCategory.name : "—"}
              detail={`${formatMoney(topCategory.spendCents / 100)} (${percent(topCategory.spendCents, totals.spendCents)}% of spend)`}
            />
            <Kpi
              title="Pending Exposure"
              value={formatMoney(totals.pendingCents / 100)}
              detail={`${totals.pending} awaiting manager decision`}
            />
          </dl>
          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <ReportTable
              id="report-categories"
              title="Category breakdown"
              columns={CATEGORY_COLUMNS}
            >
              <BreakdownRows
                rows={categories}
                total={totals.spendCents}
                showCategoryShare
              />
            </ReportTable>
            <ReportTable
              id="report-departments"
              title="Department breakdown"
              columns={DEPARTMENT_COLUMNS}
              empty={
                !departments.length && (
                  <p className="p-5 text-sm text-zinc-600">
                    No departments match the current filters.
                  </p>
                )
              }
            >
              <BreakdownRows rows={departments} total={totals.spendCents} />
            </ReportTable>
          </div>
          <ReportTable
            id="report-preview"
            title="Filtered expenses"
            columns={EXPENSE_COLUMNS}
            preview
            empty={
              !filtered.length && (
                <EmptyState
                  title={
                    !data?.length
                      ? "No expenses to report"
                      : "No matching expenses"
                  }
                  description={
                    !data?.length
                      ? "Expenses will appear here as they are submitted."
                      : "Update or reset the filters to view more expenses."
                  }
                />
              )
            }
          >
            {filtered.map((expense) => (
              <tr key={expense.id}>
                <td>#{expense.id}</td>
                <td className="min-w-44 font-medium wrap-anywhere" dir="auto">
                  {expense.title || "—"}
                </td>
                <td className="min-w-28" dir="auto">
                  {expense.employeeName || "—"}
                </td>
                <td dir="auto">{expense.department || "Unassigned"}</td>
                <td>{expense.category}</td>
                <td className="whitespace-nowrap">
                  {expense.amount == null ? "—" : formatMoney(expense.amount)}
                </td>
                <td>
                  <StatusBadge status={expense.status} />
                </td>
                <td className="whitespace-nowrap">
                  {formatDate(expense.date)}
                </td>
              </tr>
            ))}
          </ReportTable>
        </>
      )}
    </>
  );
}
