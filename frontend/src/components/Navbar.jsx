import { ArrowUpRight, Building2, ChevronDown, LayoutDashboard, LogOut, Plus, ReceiptText } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api, USE_MOCK } from '../services/api';
import { canUseFinance, hasPermission, PERMISSIONS, STATUS } from '../utils/constants';
import { formatDate, initials } from '../utils/formatters';

export function Brand({ light = false }) {
  return <span className={`inline-flex items-center gap-2.5 ${light ? 'text-white' : 'text-slate-900'}`}><span className="brand-mark"><svg viewBox="0 0 32 32" aria-hidden="true"><path d="M6 23V9l10 10L26 9v14" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg></span><span className="text-xl font-bold tracking-tight">masroof<span className="text-emerald-500">.</span></span></span>;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [pending, setPending] = useState(null);
  const area = pathname.startsWith('/manager') ? 'manager' : pathname.startsWith('/finance') ? 'finance' : 'employee';
  const views = [hasPermission(user, PERMISSIONS.OWN) && ['employee', 'Employee workspace'], hasPermission(user, PERMISSIONS.DEPARTMENT) && ['manager', 'Manager workspace'], canUseFinance(user) && ['finance', 'Finance workspace']].filter(Boolean);
  useEffect(() => {
    if (area === 'finance') return;
    let active = true;
    let inFlight = false;
    setPending(null);
    async function refresh() {
      if (inFlight || document.hidden) return;
      inFlight = true;
      try {
        const expenses = await api.allExpenses({ view: area === 'manager' ? 'department' : 'own' });
        const count = expenses.filter((expense) => area === 'manager'
          ? expense.status === STATUS.PENDING_MANAGER && expense.requester?.id !== user.id
          : [STATUS.PENDING_MANAGER, STATUS.PENDING_FINANCE].includes(expense.status)).length;
        if (active) setPending(count);
      } catch { if (active) setPending(null); }
      finally { inFlight = false; }
    }
    refresh();
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { active = false; window.clearInterval(interval); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [area, pathname, user.id]);
  const links = area === 'manager' ? [{ to: '/manager/dashboard', label: 'Department overview', Icon: LayoutDashboard, pending: true }]
    : area === 'finance' ? [{ to: '/finance/dashboard', label: 'Finance', Icon: Building2 }]
      : [{ to: '/employee/dashboard', label: 'Overview', Icon: LayoutDashboard }, { to: '/employee/expenses', label: 'My expenses', Icon: ReceiptText, pending: true }, { to: '/employee/expenses/new', label: 'New expense', Icon: Plus }];
  return <div className="workspace-shell">
    <a href="#main-content" className="skip-link">Skip to content</a>
    <header className="topbar">
      <Link to={`/${area}/dashboard`} className="mobile-brand" aria-label="Masroof home"><Brand /></Link>
      <span className="hidden text-[11px] text-zinc-400 lg:block">Expense management, considered.</span>
      <div className="ml-auto flex min-w-0 items-center gap-3 sm:gap-5">
        {USE_MOCK && <span className="hidden rounded-full border border-zinc-200 bg-[#F6F6F4] px-3 py-1.5 text-[10px] font-medium text-zinc-500 sm:inline-flex">Demo workspace</span>}
        <div className="hidden text-right md:block"><p className="text-xs font-semibold" dir="auto">{user.full_name}</p><p className="mt-1 text-[10px] capitalize text-zinc-400">{area} workspace</p></div>
        <div aria-hidden="true" className="avatar" dir="auto">{initials(user.full_name)}</div>
        <button className="icon-button mobile-logout" aria-label="Log out" title="Log out" onClick={() => { logout(); navigate('/login'); }}><LogOut size={16} /></button>
      </div>
    </header>
    <div className="app-shell">
      <aside className="sidebar">
        <Link to={`/${area}/dashboard`} className="sidebar-brand" aria-label="Masroof home"><Brand /></Link>
        <div className="workspace-switcher relative mb-7">
          <label htmlFor={views.length > 1 ? 'workspace' : undefined} className="mb-2.5 block px-1 text-[9px] font-medium uppercase tracking-[0.16em] text-zinc-400">Your workspace</label>
          {views.length > 1 ? <><select id="workspace" value={area} onChange={(event) => navigate(`/${event.target.value}/dashboard`)} className="workspace-select">{views.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><ChevronDown aria-hidden="true" size={14} className="pointer-events-none absolute bottom-3.5 right-3 text-zinc-400" /></> : <div className="workspace-badge">{views[0]?.[1]}</div>}
        </div>
        <p className="mb-3 hidden px-3 text-[9px] font-medium uppercase tracking-[0.16em] text-zinc-400 lg:block">Workspace</p>
        <nav aria-label="Main navigation" className="nav-list">
          {links.map(({ to, label, Icon, pending: showPending }) => <NavLink key={to} to={to} end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}><Icon size={17} />{label}
            {showPending && pending !== null && <span className="nav-count" aria-label={`${pending} pending requests`} aria-live="polite">{pending}</span>}
            {to.endsWith('/new') && <span className="ml-auto text-lg font-light">+</span>}
          </NavLink>)}
        </nav>
        {canUseFinance(user) && area !== 'finance' && <Link className="nav-item mt-4" to="/finance/dashboard"><Building2 size={17} />Finance<ArrowUpRight size={13} className="ml-auto" /></Link>}
        <div className="sidebar-footer">
          <div className="flex items-center gap-3 border-t border-zinc-100 pt-4"><span className="avatar shrink-0" dir="auto">{initials(user.full_name)}</span><div className="min-w-0"><p className="truncate text-xs font-medium" dir="auto">{user.full_name}</p><p className="mt-1 truncate text-[10px] text-zinc-400" dir="auto">{user.department?.name || `Department ${user.department_id}`}</p><p className="mt-1 text-[9px] capitalize text-zinc-500">{area} workspace</p></div></div>
          <button className="mt-4 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-[11px] text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900" onClick={() => { logout(); navigate('/login'); }}><LogOut size={14} />Log out</button>
        </div>
      </aside>
      <main id="main-content" className="main-content">
        <div className="mb-7 flex items-center justify-between gap-3 text-[10px] text-zinc-400"><span>Workspace <span className="mx-2">/</span><span className="capitalize text-zinc-600">{area}</span></span><span className="tabular-nums">{formatDate(new Date())}</span></div>
        <Outlet />
      </main>
    </div>
  </div>;
}
