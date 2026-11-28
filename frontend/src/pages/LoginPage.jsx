import {
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Brand } from "../components/Navbar";
import Squares from "../components/reactbits/Squares";
import { ErrorBox, Spinner } from "../components/UI";
import { useAuth } from "../context/AuthContext";
import { CURRENCY } from "../utils/constants";
import { preferredHomeFor } from "../utils/workspaceRoutes";

export default function LoginPage() {
  const {
    user,
    loading,
    error: sessionError,
    retry,
    logout,
    login,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (loading) return <Spinner />;
  if (sessionError)
    return (
      <div className="mx-auto max-w-lg p-8">
        <ErrorBox message={sessionError} retry={retry} />
        <button className="btn-secondary mt-4" onClick={logout}>
          Return to login
        </button>
      </div>
    );
  if (user) return <Navigate to={preferredHomeFor(user)} replace />;
  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const profile = await login(username, password);
      const from = location.state?.from;
      navigate(
        from?.startsWith("/") && !from.startsWith("//") && from !== "/login"
          ? from
          : preferredHomeFor(profile),
        { replace: true },
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-shell">
      <section className="login-story">
        <div className="login-brand">
          <Brand light />
        </div>
        <div className="login-story-content">
          <div className="login-story-pill">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            WORK EXPENSES, SIMPLIFIED
          </div>
          <h1>
            Less paperwork.
            <br />
            <span className="text-emerald-300">More peace of mind.</span>
          </h1>
          <p className="login-story-subtitle">
            From the first receipt to the final approval. Keep every work
            expense moving, with clarity at every step.
          </p>
          <div className="login-receipt">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <p className="login-receipt-label">YOUR NEXT REIMBURSEMENT</p>
                <p className="login-receipt-amount tabular-nums">
                  {CURRENCY} 2,299.75
                </p>
              </div>
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Check size={24} />
              </div>
            </div>
            <div className="login-receipt-metadata">
              <span className="text-slate-500">Receipts in. Worries out.</span>
              <span className="font-medium text-emerald-600">
                All accounted for ↗
              </span>
            </div>
          </div>
        </div>
        <div className="relative z-10 flex items-center justify-between gap-4 text-xs text-emerald-100/50">
          <span>Built for your workday.</span>
          <span lang="ar" dir="rtl">
            مصروفك، بكل وضوح
          </span>
        </div>
      </section>
      <main className="login-form-panel">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <Squares
            borderColor="rgba(16, 185, 129, 0.12)"
            hoverFillColor="rgba(16, 185, 129, 0.05)"
            speed={0.25}
            squareSize={48}
          />
        </div>
        <div className="login-mobile-brand login-brand">
          <Brand />
        </div>
        <div className="login-auth-card">
          <p className="login-eyebrow">Welcome to Masroof</p>
          <h2>Good to see you.</h2>
          <p className="login-subtitle">
            Sign in to manage your expenses and approvals.
          </p>
          {error && (
            <div className="mt-6">
              <ErrorBox id="login-error" message={error} />
            </div>
          )}
          <form
            className="mt-6 space-y-5"
            aria-describedby={error ? "login-error" : undefined}
            aria-busy={busy}
            onSubmit={(event) => {
              event.preventDefault();
              signIn();
            }}
          >
            <div>
              <label className="field-label" htmlFor="username">
                Username or email
              </label>
              <input
                id="username"
                name="username"
                className="input"
                dir="auto"
                autoComplete="username"
                placeholder="you@company.sa"
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setError("");
                }}
                required
                disabled={!!busy}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  className="input"
                  dir="auto"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError("");
                  }}
                  required
                  disabled={!!busy}
                />
                <button
                  className="login-password-toggle"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              className="btn-primary login-submit w-full justify-center"
              disabled={!!busy}
            >
              {busy ? (
                <>
                  <LoaderCircle
                    size={18}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Signing in…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
          <p className="login-trust">
            <ShieldCheck size={15} />
            Your workspace. Your company. One clear view.
          </p>
        </div>
      </main>
    </div>
  );
}
