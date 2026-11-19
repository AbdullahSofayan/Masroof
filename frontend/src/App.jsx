import { Component, useEffect } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/ProtectedRoute";
import { ErrorBox, Spinner } from "./components/UI";
import { useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import ReportsPage from "./pages/ReportsPage";
import AddExpensePage from "./pages/employee/AddExpensePage";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import MyExpensesPage from "./pages/employee/MyExpensesPage";
import BudgetsPage from "./pages/finance/BudgetsPage";
import CategoryLimitsPage from "./pages/finance/CategoryLimitsPage";
import FinanceDashboard from "./pages/finance/FinanceDashboard";
import ForecastPage from "./pages/finance/ForecastPage";
import ExpenseReviewPage from "./pages/manager/ExpenseReviewPage";
import ManagerDashboard from "./pages/manager/ManagerDashboard";
import { homeFor, PERMISSIONS, ROLE_PERMISSIONS } from "./utils/constants";
import {
  applyDensityPreference,
  getUserPreferences,
} from "./utils/preferences";
import { preferredHomeFor, REPORT_ROLES } from "./utils/workspaceRoutes";

function Home() {
  const { user, loading, error, retry, logout } = useAuth();
  if (loading) return <Spinner />;
  if (error)
    return (
      <div className="mx-auto max-w-lg p-8">
        <ErrorBox message={error} retry={retry} />
        <button className="btn-secondary mt-4" onClick={logout}>
          Return to login
        </button>
      </div>
    );
  return <Navigate to={user ? preferredHomeFor(user) : "/login"} replace />;
}
function Unavailable({ forbidden = false }) {
  const { user, logout } = useAuth();
  return (
    <main className="mx-auto max-w-md p-8 pt-28 text-center">
      <p className="text-sm font-semibold text-emerald-600">
        {forbidden ? "Access restricted" : "404"}
      </p>
      <h1 className="mt-3 text-2xl font-semibold">
        {forbidden
          ? "This view isn’t available to your account."
          : "This page took a different route."}
      </h1>
      <p className="mt-4 text-sm leading-6 text-slate-500">
        {forbidden
          ? "Your workspace permissions determine which pages you can open."
          : "Check the address or head back to your workspace."}
      </p>
      {user && homeFor(user) === "/access-denied" ? (
        <button className="btn-primary mt-6" onClick={logout}>
          Log out
        </button>
      ) : (
        <Link className="btn-primary mt-6" to={user ? homeFor(user) : "/login"}>
          Back to workspace
        </Link>
      )}
    </main>
  );
}
export class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="mx-auto max-w-lg p-8 pt-28">
        <h1 className="mb-4 text-xl font-semibold">
          We couldn’t display this page.
        </h1>
        <p className="mb-6 text-sm text-slate-500">
          Reload to try again. Your saved demo expenses will still be here.
        </p>
        <button
          className="btn-primary"
          onClick={() => window.location.reload()}
        >
          Reload workspace
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
export default function App() {
  const { user } = useAuth();
  const userId = user?.id;
  useEffect(() => {
    applyDensityPreference(
      user?.role && getUserPreferences(userId).compactTables,
    );
    return () => applyDensityPreference(false);
  }, [userId, user?.role]);

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute roles={Object.keys(ROLE_PERMISSIONS)} />}>
        <Route element={<Navbar />}>
          <Route path="/profile" element={<ProfilePage key={userId} />} />
          <Route element={<ProtectedRoute roles={REPORT_ROLES} />}>
            <Route
              path="/reports"
              element={<ReportsPage key={`${userId}:${user?.role}`} />}
            />
          </Route>
          <Route element={<ProtectedRoute permission={PERMISSIONS.OWN} />}>
            <Route
              path="/employee"
              element={<Navigate to="/employee/dashboard" replace />}
            />
            <Route path="/employee/dashboard" element={<EmployeeDashboard />} />
            <Route path="/employee/expenses" element={<MyExpensesPage />} />
            <Route path="/employee/expenses/new" element={<AddExpensePage />} />
            <Route
              path="/employee/expenses/:id/edit"
              element={<AddExpensePage />}
            />
          </Route>
          <Route
            element={<ProtectedRoute permission={PERMISSIONS.DEPARTMENT} />}
          >
            <Route
              path="/manager"
              element={<Navigate to="/manager/dashboard" replace />}
            />
            <Route path="/manager/dashboard" element={<ManagerDashboard />} />
            <Route
              path="/manager/expenses/:id"
              element={<ExpenseReviewPage />}
            />
          </Route>
          <Route element={<ProtectedRoute finance />}>
            <Route
              path="/finance"
              element={<Navigate to="/finance/dashboard" replace />}
            />
            <Route path="/finance/dashboard" element={<FinanceDashboard />} />
            <Route
              path="/finance/queue"
              element={<Navigate to="/finance/dashboard" replace />}
            />
            <Route
              path="/finance/history"
              element={<Navigate to="/finance/dashboard" replace />}
            />
            <Route
              path="/finance/expenses/:id"
              element={<Navigate to="/finance/dashboard" replace />}
            />
            <Route path="/finance/budgets" element={<BudgetsPage />} />
            <Route path="/finance/limits" element={<CategoryLimitsPage />} />
            <Route path="/finance/forecast" element={<ForecastPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="/access-denied" element={<Unavailable forbidden />} />
      <Route path="*" element={<Unavailable />} />
    </Routes>
  );
}
