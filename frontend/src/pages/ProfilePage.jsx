import { Check, LogOut, Settings2, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { PageHeading } from "../components/UI";
import { useAuth } from "../context/AuthContext";
import { USE_MOCK } from "../services/api";
import { recordName } from "../utils/expenseFields";
import { initials, userDisplayName } from "../utils/formatters";
import {
  getUserPreferences,
  resetUserPreferences,
  saveUserPreferences,
} from "../utils/preferences";
import { getLandingOptions } from "../utils/workspaceRoutes";

const ROLE_DETAILS = {
  employee: {
    label: "Employee",
    permissions: [
      "Submit new expenses",
      "Track personal requests",
      "View receipts",
    ],
  },
  manager: {
    label: "Manager",
    permissions: [
      "Submit personal expenses",
      "Review the team queue",
      "Make final approval or rejection decisions",
    ],
  },
  finance: {
    label: "Finance",
    permissions: [
      "View company spending",
      "Monitor unusual requests",
      "Manage monthly budgets and category limits",
      "View spend forecasts",
    ],
  },
  admin: {
    label: "Admin",
    permissions: [
      "Employee workspace",
      "Manager workspace",
      "Finance workspace",
      "Reporting workspace",
    ],
  },
};

function PreferenceSwitch({ id, label, description, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div>
        <label
          id={`${id}-label`}
          className="block text-sm font-medium"
          htmlFor={id}
        >
          {label}
        </label>
        <p id={`${id}-description`} className="mt-1 text-sm text-zinc-600">
          {description}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-description`}
        className={`relative flex h-7 w-12 shrink-0 items-center rounded-full border px-0.5 transition-colors before:absolute before:-inset-y-2 before:inset-x-0 ${checked ? "border-emerald-700 bg-emerald-700 hover:bg-emerald-800" : "border-zinc-500 bg-zinc-500 hover:bg-zinc-600"}`}
        onClick={() => onChange(!checked)}
      >
        <span
          aria-hidden="true"
          className={`size-5 rounded-full bg-white shadow-sm transition-transform duration-150 ${checked ? "translate-x-5" : ""}`}
        />
      </button>
    </div>
  );
}

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const [form, setForm] = useState(() => getUserPreferences(user.id));
  const [status, setStatus] = useState("");
  const name = userDisplayName(user);
  const role = ROLE_DETAILS[user.role];
  const department =
    recordName(user.department) ||
    (user.department_id ? `Department ${user.department_id}` : "General");
  const landingOptions = getLandingOptions(user);
  const landingRoute = landingOptions.some(
    ([route]) => route === form.defaultLandingRoute,
  )
    ? form.defaultLandingRoute
    : "role-default";

  function updatePreference(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
    setStatus("");
  }

  return (
    <>
      <PageHeading
        title="Profile & Settings"
        description="Manage your account details, workspace density, and notification preferences."
      />
      <div className="workspace-grid grid-cols-1 lg:grid-cols-3">
        <section className="card bento-panel" aria-labelledby="account-heading">
          <h2 id="account-heading" className="bento-title">
            Account identity
          </h2>
          <span
            aria-hidden="true"
            className="mt-5 flex size-14 items-center justify-center rounded-full bg-emerald-50 text-lg font-semibold text-emerald-700"
            dir="auto"
          >
            {initials(name)}
          </span>
          <p className="mt-3 text-lg font-semibold wrap-anywhere">
            <bdi>{name}</bdi>
          </p>
          <p className="mt-1 text-sm wrap-anywhere text-zinc-600" dir="auto">
            {user.email || user.username}
          </p>
          <span className="status-badge mt-3 border-emerald-200 bg-emerald-50 text-emerald-700">
            {role.label}
          </span>
          <dl className="mt-5 space-y-3 border-t border-zinc-100 pt-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <dt className="text-zinc-600">Department</dt>
              <dd className="font-medium wrap-anywhere" dir="auto">
                {department}
              </dd>
            </div>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <dt className="text-zinc-600">User ID</dt>
              <dd className="font-medium wrap-anywhere tabular-nums">
                {user.id ?? "—"}
              </dd>
            </div>
          </dl>
          <span className="status-badge mt-5 border-zinc-200 bg-zinc-50 text-zinc-700">
            {USE_MOCK ? "Mock Data Mode" : "Live Backend Connected"}
          </span>
        </section>

        <section
          className="card bento-panel lg:col-span-2"
          aria-labelledby="preferences-heading"
        >
          <div className="mb-1 flex items-center gap-2.5">
            <Settings2
              size={17}
              className="text-emerald-700"
              aria-hidden="true"
            />
            <h2 id="preferences-heading" className="bento-title">
              Workspace preferences
            </h2>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setForm(
                saveUserPreferences(user.id, {
                  ...form,
                  defaultLandingRoute: landingRoute,
                }),
              );
              setStatus("Preferences saved");
            }}
          >
            <div className="divide-y divide-zinc-100">
              <PreferenceSwitch
                id="preference-notifications"
                label="In-App Notification Badges"
                description="Show unread alert counts on the navigation bell."
                checked={form.showNotificationBadge}
                onChange={(value) =>
                  updatePreference("showNotificationBadge", value)
                }
              />
              <PreferenceSwitch
                id="preference-density"
                label="Compact Table Density"
                description="Reduce table row padding to view more expense records at once."
                checked={form.compactTables}
                onChange={(value) => updatePreference("compactTables", value)}
              />
              <div className="py-4">
                <label className="field-label" htmlFor="preference-landing">
                  Default Landing Page
                </label>
                <select
                  className="input sm:max-w-xs"
                  id="preference-landing"
                  value={landingRoute}
                  onChange={(event) =>
                    updatePreference("defaultLandingRoute", event.target.value)
                  }
                >
                  <option value="role-default">Role Default</option>
                  {landingOptions.map(([route, label]) => (
                    <option key={route} value={route}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 border-t border-zinc-100 pt-4">
              <button className="btn-primary" type="submit">
                Save Preferences
              </button>
              <button
                className="btn-secondary"
                type="button"
                onClick={() => {
                  setForm(resetUserPreferences(user.id));
                  setStatus("Preferences reset to defaults");
                }}
              >
                Reset Defaults
              </button>
              <p role="status" className="text-sm font-medium text-emerald-700">
                {status}
              </p>
            </div>
          </form>
        </section>

        <section
          className="card bento-panel lg:col-span-3"
          aria-labelledby="permissions-heading"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck
                size={18}
                className="text-emerald-700"
                aria-hidden="true"
              />
              <h2 id="permissions-heading" className="bento-title">
                Role permissions & session
              </h2>
            </div>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => logout()}
            >
              <LogOut size={16} aria-hidden="true" /> Sign Out
            </button>
          </div>
          <ul className="mt-4 flex flex-wrap gap-2">
            {role.permissions.map((permission) => (
              <li
                key={permission}
                className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700"
              >
                <Check
                  size={13}
                  aria-hidden="true"
                  className="shrink-0 text-emerald-700"
                />
                {permission}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
