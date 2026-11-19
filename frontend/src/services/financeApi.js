// Finance workspace API.
// Flow (main + ML contract v0.4, 18 Nov): the department manager is the only approval step, so
// Finance does not review requests. Finance sees the company picture, sets monthly budgets and
// category limits, and reads the AI summary and the forecast.
// With USE_MOCK the data lives in browser storage. Real routes for budgets, limits, the dashboard,
// the AI summary and the forecast do not exist on main yet; the paths below are PROPOSALS.
import { PERMISSIONS, STATUS, hasPermission } from '../utils/constants';
import { today } from '../utils/formatters';
import { actor, ApiError, readData, request, sleep, USE_MOCK, writeData } from './api';
import { demoCategories } from './mockData';
import {
  addDays, COMPANY_SEED_START_ID, companyPeopleIds, createCompanyExpenses, createFinanceSettings, FINANCE_STORAGE_KEY,
  financeDepartments, forecastSeeds, SEED_VERSION, weekStart,
} from './financeMock';

export const RISK_LEVELS = ['high', 'medium', 'low'];
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const sum = (items) => money(items.reduce((total, entry) => total + (Number(entry.amount) || 0), 0));
const monthKey = (year, month) => `${year}-${String(month).padStart(2, '0')}`;
const currentPeriod = () => { const [year, month] = today().split('-').map(Number); return { year, month }; };

/**
 * One approval step: map older two-step statuses so Finance totals stay right while the
 * employee/manager pages still use them. pending_finance = the manager already approved.
 */
export function effectiveStatus(status) {
  const value = String(status || '').toLowerCase();
  if (value === 'approved' || value === STATUS.PENDING_FINANCE) return STATUS.APPROVED;
  if (value === 'rejected') return STATUS.REJECTED;
  return STATUS.PENDING_MANAGER; // Pending, pending_manager, needs_changes
}

/** AI view in the ML contract's shape ({risk_level, reasons}) or null when not scored. */
export function aiView(expense) {
  if (expense.ai !== undefined) return expense.ai;
  // EXPENSE columns from the final ERD (risk_level + risk_justification), if the API returns them directly.
  if (expense.risk_level !== undefined) return RISK_LEVELS.includes(expense.risk_level) ? { risk_level: expense.risk_level, reasons: expense.risk_justification || [] } : null;
  const level = expense.ai_analysis?.risk_level?.toLowerCase();
  return RISK_LEVELS.includes(level) ? { risk_level: level, reasons: [] } : null;
}

/**
 * Accepts the demo shape, the old skeleton's ExpenseRead, or main's ExpenseResponse
 * ({expense_id, category: "Food", status: "Pending"}) and returns the shape the pages use.
 */
export function normalizeExpense(expense, departments = []) {
  const departmentId = expense.department?.id ?? expense.department_id ?? null;
  const category = typeof expense.category === 'string' ? { id: null, name: expense.category } : expense.category;
  return {
    ...expense,
    id: expense.id ?? expense.expense_id,
    category,
    department: expense.department || { id: departmentId, name: departments.find((entry) => entry.id === departmentId)?.name || (departmentId ? `Department ${departmentId}` : 'Unassigned') },
    requester: expense.requester || { id: expense.requester_id ?? null, full_name: '—' },
    amount: String(expense.amount),
    status: effectiveStatus(expense.status),
    ai: aiView(expense),
    warnings: expense.warnings || [],
  };
}

function financeUser() {
  const user = actor();
  if (!(user.role === 'finance_admin' || hasPermission(user, PERMISSIONS.FINANCE))) throw new ApiError('Only Finance can use this workspace.', 403);
  return user;
}

/** Shared expense store plus the other departments' demo expenses (added once, refreshed if outdated). */
const isCompanySeed = (entry) => companyPeopleIds.has(entry.requester?.id);
function companyData() {
  let data = readData();
  const seeds = data.filter(isCompanySeed);
  if (!seeds.length || seeds.some((entry) => entry.seed_version !== SEED_VERSION)) {
    const kept = data.filter((entry) => !isCompanySeed(entry)); // keep everything employees created
    const firstId = Math.max(COMPANY_SEED_START_ID, ...kept.map((entry) => entry.id + 1));
    data = [...kept, ...createCompanyExpenses(today()).map((entry, index) => ({ ...entry, id: firstId + index }))];
    writeData(data);
  }
  return data.map((entry) => normalizeExpense(entry, financeDepartments));
}

function readSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(FINANCE_STORAGE_KEY));
    if (Array.isArray(stored?.budgets) && Array.isArray(stored?.limits)) return stored;
  } catch { /* fall back to the seeded settings */ }
  return createFinanceSettings(today());
}
function writeSettings(settings) {
  try { localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(settings)); }
  catch { throw new ApiError('Demo storage is full or unavailable. Free browser storage and try again.'); }
}

/** Same keys as backend/finance budget_usage(): budget, spent, remaining, percent. */
export function budgetUsage(spent, budget) {
  const amount = money(budget); const used = money(spent);
  return { budget: amount.toFixed(2), spent: used.toFixed(2), remaining: money(amount - used).toFixed(2), percent: amount === 0 ? 0 : Math.round(used / amount * 1000) / 10 };
}
const approvedIn = (expenses, departmentId, year, month) => expenses.filter((entry) => entry.status === STATUS.APPROVED
  && entry.department.id === departmentId && entry.expense_date.startsWith(monthKey(year, month)));

// Same rules as backend/finance: max 12 digits with 2 decimals (so at most 10 before the point).
function validateAmount(value, message, { allowZero = false } = {}) {
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(String(value)) || Number(value) < 0 || (!allowZero && Number(value) === 0)) throw new ApiError(message);
}
const asList = (result) => (Array.isArray(result) ? result : result?.items || []);

export const financeApi = {
  departments: async () => {
    if (!USE_MOCK) return asList(await request('/departments'));
    await sleep(); financeUser(); return structuredClone(financeDepartments);
  },
  categories: async () => {
    if (!USE_MOCK) return asList(await request('/categories'));
    await sleep(); financeUser(); return structuredClone(demoCategories);
  },

  /** Every expense in the company, newest first. */
  async expenses({ status = '' } = {}) {
    let list;
    if (!USE_MOCK) {
      const departments = await financeApi.departments().catch(() => []); // optional: not on main yet
      list = asList(await request('/expenses')).map((entry) => normalizeExpense(entry, departments));
    } else { await sleep(); financeUser(); list = companyData(); }
    return list.filter((entry) => !status || entry.status === status)
      .sort((a, b) => b.expense_date.localeCompare(a.expense_date) || b.id - a.id);
  },

  /** Company totals, built from the expense list so it works before a dashboard route exists. */
  async dashboard() {
    const [expenses, budgets] = await Promise.all([financeApi.expenses(), financeApi.budgets(currentPeriod())]);
    const approved = expenses.filter((entry) => entry.status === STATUS.APPROVED);
    const { year, month } = currentPeriod();
    const totalBudget = sum(budgets);
    const spentThisMonth = sum(approved.filter((entry) => entry.expense_date.startsWith(monthKey(year, month))));
    const months = new Map(); const people = new Map(); const departments = new Map();
    approved.forEach((entry) => {
      const key = entry.expense_date.slice(0, 7);
      months.set(key, money((months.get(key) || 0) + Number(entry.amount)));
      const person = people.get(entry.requester.id) || { user_id: entry.requester.id, full_name: entry.requester.full_name, total: 0 };
      person.total = money(person.total + Number(entry.amount)); people.set(entry.requester.id, person);
      const department = departments.get(entry.department.id) || { department_id: entry.department.id, department_name: entry.department.name, total: 0 };
      department.total = money(department.total + Number(entry.amount)); departments.set(entry.department.id, department);
    });
    return {
      expenses,
      approved_total: sum(approved).toFixed(2),
      pending_total: sum(expenses.filter((entry) => entry.status === STATUS.PENDING_MANAGER)).toFixed(2),
      total_budget: totalBudget.toFixed(2),
      spent_this_month: spentThisMonth.toFixed(2),
      by_department: [...departments.values()].sort((a, b) => b.total - a.total),
      monthly: [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, total]) => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5)), total: total.toFixed(2) })),
      top_employees: [...people.values()].sort((a, b) => b.total - a.total).slice(0, 5),
    };
  },

  /**
   * "Unusual requests" for the Finance dashboard — AnomalySummary from ML contract C9.
   * Counts this month's requests; never exposes anomaly_score.
   */
  async anomalySummary({ year, month } = currentPeriod()) {
    if (!USE_MOCK) return request(`/dashboard/finance/anomalies?year=${year}&month=${month}`);
    const expenses = (await financeApi.expenses()).filter((entry) => entry.expense_date.startsWith(monthKey(year, month)));
    const counts = { high: 0, medium: 0, low: 0, not_scored: 0 };
    const departments = new Map(); const reasons = new Map();
    expenses.forEach((entry) => {
      const level = entry.ai?.risk_level;
      if (!RISK_LEVELS.includes(level)) { counts.not_scored += 1; return; }
      counts[level] += 1;
      const flagged = level !== 'low';
      const row = departments.get(entry.department.id) || { department_id: entry.department.id, department_name: entry.department.name, flagged: 0, total: 0 };
      row.total += 1; if (flagged) row.flagged += 1; departments.set(entry.department.id, row);
      if (flagged) (entry.ai.reasons || []).forEach((item) => { const current = reasons.get(item.code) || { ...item, count: 0 }; current.count += 1; reasons.set(item.code, current); });
    });
    return {
      counts,
      by_department: [...departments.values()].map((row) => ({ ...row, flagged_percent: row.total ? Math.round(row.flagged / row.total * 1000) / 10 : 0 }))
        .sort((a, b) => b.flagged_percent - a.flagged_percent),
      top_reasons: [...reasons.values()].sort((a, b) => b.count - a.count).slice(0, 5),
    };
  },

  /** Monthly budgets (backend/finance BudgetCreate: department_id, year, month, amount). */
  async budgets({ year, month } = {}) {
    if (!USE_MOCK) return asList(await request(`/budgets${year ? `?year=${year}${month ? `&month=${month}` : ''}` : ''}`));
    await sleep(); financeUser();
    return structuredClone(readSettings().budgets.filter((budget) => (!year || budget.year === Number(year)) && (!month || budget.month === Number(month))));
  },
  async budgetUsage(budget) {
    if (!USE_MOCK) return request(`/budgets/${budget.id}/usage`);
    await sleep(); financeUser();
    return budgetUsage(sum(approvedIn(companyData(), budget.department_id, budget.year, budget.month)), budget.amount);
  },
  async createBudget(payload) {
    const body = { department_id: Number(payload.department_id), year: Number(payload.year), month: Number(payload.month), amount: String(payload.amount).trim() };
    if (!financeDepartments.some((entry) => entry.id === body.department_id) && USE_MOCK) throw new ApiError('Choose a department.');
    if (!Number.isInteger(body.year) || body.year < 2000 || body.year > 2100) throw new ApiError('Enter a valid year.');
    if (!(body.month >= 1 && body.month <= 12)) throw new ApiError('Choose a month.');
    validateAmount(body.amount, 'Enter a budget amount of zero or more (up to 10 digits, 2 decimals).', { allowZero: true });
    if (!USE_MOCK) return request('/budgets', { method: 'POST', body });
    await sleep(); financeUser();
    const settings = readSettings();
    if (settings.budgets.some((budget) => budget.department_id === body.department_id && budget.year === body.year && budget.month === body.month)) {
      throw new ApiError('This department already has a budget for that month. Edit it instead.', 409);
    }
    const budget = { id: Math.max(0, ...settings.budgets.map((entry) => entry.id)) + 1, ...body, amount: money(body.amount).toFixed(2) };
    settings.budgets.push(budget); writeSettings(settings); return structuredClone(budget);
  },
  async updateBudget(id, amount) {
    validateAmount(String(amount).trim(), 'Enter a budget amount of zero or more (up to 10 digits, 2 decimals).', { allowZero: true });
    if (!USE_MOCK) return request(`/budgets/${id}`, { method: 'PATCH', body: { amount: String(amount).trim() } });
    await sleep(); financeUser();
    const settings = readSettings(); const budget = settings.budgets.find((entry) => entry.id === Number(id));
    if (!budget) throw new ApiError('This budget could not be found.', 404);
    budget.amount = money(amount).toFixed(2); writeSettings(settings); return structuredClone(budget);
  },
  async deleteBudget(id) {
    if (!USE_MOCK) return request(`/budgets/${id}`, { method: 'DELETE' });
    await sleep(); financeUser();
    const settings = readSettings(); settings.budgets = settings.budgets.filter((entry) => entry.id !== Number(id)); writeSettings(settings); return null;
  },

  /** Category limits (backend/finance ExpenseLimitCreate: category_id, max_amount). One per category. */
  async limits() {
    if (!USE_MOCK) return asList(await request('/expense-limits'));
    await sleep(); financeUser(); return structuredClone(readSettings().limits);
  },
  /** Set the max amount per request for a category; empty removes the limit. */
  async saveLimit(categoryId, maxAmount, existingId = null) {
    const limit = maxAmount === '' || maxAmount === null || maxAmount === undefined ? null : String(maxAmount).trim();
    if (limit !== null) validateAmount(limit, 'Enter a limit greater than zero (up to 10 digits, 2 decimals), or leave it empty for no limit.');
    if (!USE_MOCK) {
      if (limit === null) return existingId ? request(`/expense-limits/${existingId}`, { method: 'DELETE' }) : null;
      return existingId ? request(`/expense-limits/${existingId}`, { method: 'PATCH', body: { max_amount: limit } })
        : request('/expense-limits', { method: 'POST', body: { category_id: Number(categoryId), max_amount: limit } });
    }
    await sleep(); financeUser();
    const settings = readSettings();
    if (limit === null) { settings.limits = settings.limits.filter((entry) => entry.category_id !== Number(categoryId)); writeSettings(settings); return null; }
    let entry = settings.limits.find((item) => item.category_id === Number(categoryId));
    if (!entry) { entry = { id: Math.max(0, ...settings.limits.map((item) => item.id)) + 1, category_id: Number(categoryId) }; settings.limits.push(entry); }
    entry.max_amount = money(limit).toFixed(2); writeSettings(settings); return structuredClone(entry);
  },

  /**
   * Next four weekly totals for one department (or all when null).
   * PROPOSED contract — where the forecast is served from is still open (ML contract F4).
   */
  async forecast(departmentId = null) {
    if (!USE_MOCK) return request(`/forecast${departmentId ? `?department_id=${departmentId}` : ''}`);
    await sleep(); financeUser();
    const ids = departmentId ? [Number(departmentId)] : financeDepartments.map((entry) => entry.id);
    if (ids.some((id) => !forecastSeeds[id])) throw new ApiError('No forecast is available for this department.', 404);
    const firstWeek = weekStart(today());
    const add = (key, index) => ids.reduce((total, id) => total + forecastSeeds[id][key][index], 0);
    return {
      department_id: departmentId ? Number(departmentId) : null,
      model: 'linear_regression',
      generated_for_week: firstWeek,
      history: Array.from({ length: 8 }, (_, index) => ({ week_start: addDays(firstWeek, (index - 8) * 7), actual: add('history', index).toFixed(2) })),
      weeks: Array.from({ length: 4 }, (_, index) => ({ week_start: addDays(firstWeek, index * 7), predicted: add('predicted', index).toFixed(2) })),
      baseline_last_week: add('history', 7).toFixed(2),
    };
  },
};
