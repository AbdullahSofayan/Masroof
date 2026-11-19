import { ArrowUpRight, Plus, X } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import CategoryExposureCard, {
  expenseCategoryKey,
} from "../../components/CategoryExposureCard";
import DashboardActivity from "../../components/DashboardActivity";
import ExpenseTable from "../../components/ExpenseTable";
import ExpenseStatusFilters from "../../components/ExpenseStatusFilters";
import SummaryCards from "../../components/SummaryCards";
import SpendSparkline from "../../components/fintech/SpendSparkline";
import {
  ErrorBox,
  PageHeading,
  Pagination,
  Spinner,
} from "../../components/UI";
import AnimatedContent from "../../components/reactbits/AnimatedContent";
import { useReducedMotion } from "../../components/reactbits/motionSafety";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../services/api";
import { PAGE_SIZE, STATUS } from "../../utils/constants";
import { useAsync } from "../../utils/useAsync";

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState(null);
  const ledgerRef = useRef(null);
  const reducedMotion = useReducedMotion();
  const { data, loading, error, reload } = useAsync(
    () => api.allExpenses({ view: "own" }),
    [user.id],
  );
  if (loading) return <Spinner />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  const spendExpenses = data.filter(
    (entry) => entry.status !== STATUS.REJECTED,
  );
  const categoryExpenses = category
    ? data.filter((entry) => expenseCategoryKey(entry) === category.key)
    : data;
  const filtered = status
    ? categoryExpenses.filter((entry) => entry.status === status)
    : categoryExpenses;
  const activePage = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / PAGE_SIZE)),
  );
  function selectCategory(next) {
    setCategory((current) => (current?.key === next.key ? null : next));
    setPage(1);
    ledgerRef.current?.scrollIntoView?.({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });
  }
  return (
    <div className="dashboard-bento">
      <PageHeading
        eyebrow="EMPLOYEE OVERVIEW"
        title="Your expenses, in perspective."
        description={
          <span dir="auto">
            Welcome back, <bdi>{user.full_name}</bdi>. Here’s your workspace at
            a glance.
          </span>
        }
        action={
          <Link to="/employee/expenses/new" className="btn-primary">
            <Plus size={16} />
            New expense
          </Link>
        }
      />
      <div className="bento-grid">
        <AnimatedContent
          className="min-w-0 lg:col-span-8"
          distance={12}
          duration={0.4}
        >
          <SummaryCards expenses={data} />
        </AnimatedContent>
        <AnimatedContent
          className="min-w-0 lg:col-span-4"
          delay={0.04}
          distance={12}
          duration={0.4}
        >
          <CategoryExposureCard
            expenses={spendExpenses}
            selectedCategory={category?.key}
            onCategorySelect={selectCategory}
            onViewExpenses={() => navigate("/employee/expenses")}
          />
        </AnimatedContent>
        <AnimatedContent
          className="min-w-0 lg:col-span-7"
          delay={0.08}
          distance={12}
          duration={0.4}
        >
          <section className="card bento-panel flex h-full flex-col justify-between">
            <SpendSparkline expenses={data} />
          </section>
        </AnimatedContent>
        <AnimatedContent
          className="min-w-0 lg:col-span-5"
          delay={0.12}
          distance={12}
          duration={0.4}
        >
          <DashboardActivity expenses={data} />
        </AnimatedContent>
      </div>
      <AnimatedContent delay={0.16} distance={12} duration={0.4}>
        <section
          ref={ledgerRef}
          id="employee-expenses"
          className="card mt-5 scroll-mt-24 overflow-hidden"
        >
          <div className="card-heading">
            <div>
              <h2 className="bento-title">Expense history</h2>
              <p className="mt-1.5 text-[11px] text-zinc-400">
                Every request, from submission to reimbursement.
              </p>
            </div>
            <Link to="/employee/expenses" className="text-link">
              View all
              <ArrowUpRight size={14} />
            </Link>
          </div>
          {category && (
            <div className="category-filter-bar">
              <button
                type="button"
                className="category-filter-pill"
                aria-label="Clear category filter"
                onClick={() => {
                  setCategory(null);
                  setPage(1);
                }}
              >
                <span>
                  Category: <bdi dir="auto">{category.name}</bdi>
                </span>
                <X size={13} aria-hidden="true" />
              </button>
            </div>
          )}
          <ExpenseStatusFilters
            value={status}
            expenses={categoryExpenses}
            onChange={(next) => {
              setStatus(next);
              setPage(1);
            }}
          />
          <ExpenseTable
            expenses={filtered.slice(
              (activePage - 1) * PAGE_SIZE,
              activePage * PAGE_SIZE,
            )}
            onSelect={(id) => navigate(`/employee/expenses?expense=${id}`)}
            emptyTitle="No matching expenses"
            emptyDescription="Choose another status or submit a new expense."
          />
          <Pagination
            page={activePage}
            size={PAGE_SIZE}
            total={filtered.length}
            onChange={setPage}
          />
        </section>
      </AnimatedContent>
    </div>
  );
}
