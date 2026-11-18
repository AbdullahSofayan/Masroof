// Finance workspace API. With USE_MOCK it works on browser storage; otherwise it calls the
// backend routes defined on backend/expense (dashboard, budgets, policies, approvals).
import { DECISION, NOTE_MAX_LENGTH, PERMISSIONS, STATUS, API_PAGE_SIZE, hasPermission } from '../utils/constants';
import { today } from '../utils/formatters';
import { actor, ApiError, readData, request, sleep, USE_MOCK, writeData } from './api';
import { demoCategories } from './mockData';
import {
  addDays, COMPANY_SEED_START_ID, createCompanyExpenses, createFinanceSettings, FINANCE_STORAGE_KEY,
  financeDepartments, forecastSeeds, weekStart,
} from './financeMock';

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const sum = (items) => money(items.reduce((total, entry) => total + (Number(entry.amount) || 0), 0));
const monthOf = (date) => date.slice(0, 7);

function financeUser() {
  const user = actor();
  if (!(user.role === 'finance_admin' || hasPermission(user, PERMISSIONS.FINANCE))) throw new ApiError('Only Finance can use this workspace.', 403);
  return user;
}

/** Shared expense store plus the other departments' demo expenses (added once). */
function companyData() {
  const data = readData();
  if (!data.some((entry) => entry.id >= COMPANY_SEED_START_ID)) {
    data.push(...createCompanyExpenses(today()));
    writeData(data);
  }
  return data;
}

function readSettings() {
  try {
    const stored = JSON.parse(localStorage.getItem(FINANCE_STORAGE_KEY));
    if (stored?.budgets && stored?.policies) return stored;
  } catch { /* fall back to the seeded settings */ }
  return createFinanceSettings(today());
}
function writeSettings(settings) {
  try { localStorage.setItem(FINANCE_STORAGE_KEY, JSON.stringify(settings)); }
  catch { throw new ApiError('Demo storage is full or unavailable. Free browser storage and try again.'); }
}

function approvedInPeriod(expenses, departmentId, budget) {
  return expenses.filter((entry) => entry.status === STATUS.APPROVED && entry.department.id === departmentId
    && entry.expense_date.startsWith(budget.period_type === 'annual' ? `${budget.year}-` : `${budget.year}-${String(budget.month).padStart(2, '0')}`));
}

function usageFor(budget, expenses) {
  const spent = sum(approvedInPeriod(expenses, budget.department_id, budget));
  const amount = money(budget.amount);
  return { budget_id: budget.id, budget_amount: amount.toFixed(2), spent: spent.toFixed(2), remaining: money(amount - spent).toFixed(2), percent_used: amount > 0 ? Math.round(spent / amount * 1000) / 10 : 0 };
}

function validateBudget(payload) {
  if (!financeDepartments.some((entry) => entry.id === Number(payload.department_id))) throw new ApiError('Choose a department.');
  if (!['monthly', 'annual'].includes(payload.period_type)) throw new ApiError('Choose monthly or annual.');
  if (!Number.isInteger(Number(payload.year)) || payload.year < 2000 || payload.year > 2100) throw new ApiError('Enter a valid year.');
  if (payload.period_type === 'monthly' && !(Number(payload.month) >= 1 && Number(payload.month) <= 12)) throw new ApiError('Choose a month.');
  validateAmount(payload.amount, 'Enter a budget amount greater than zero.');
}
function validateAmount(value, message) {
  if (!/^\d+(\.\d{1,2})?$/.test(String(value)) || Number(value) <= 0) throw new ApiError(message);
}

// The backend's ExpenseRead differs from the demo shape the pages use: it has department_id
// (not a department object), attachment (not attachment_url) and no approvals list.
const DECISION_TO_STATUS = { approved: { manager: STATUS.PENDING_FINANCE, finance: STATUS.APPROVED }, rejected: { manager: STATUS.REJECTED, finance: STATUS.REJECTED }, changes_requested: { manager: STATUS.NEEDS_CHANGES, finance: STATUS.NEEDS_CHANGES } };
export function normalizeApproval(entry) {
  if (entry.actor_name) return entry;
  return { id: entry.id, actor_name: entry.approver?.full_name || 'Unknown', decision: DECISION_TO_STATUS[entry.decision]?.[entry.step] || entry.decision, note: entry.note || '', created_at: entry.decided_at };
}
export function normalizeExpense(expense, departments = [], approvals = null) {
  const departmentId = expense.department?.id ?? expense.department_id;
  return {
    ...expense,
    department: expense.department || { id: departmentId, name: departments.find((entry) => entry.id === departmentId)?.name || `Department ${departmentId}` },
    attachment_url: expense.attachment_url ?? (expense.attachment ? `/expenses/${expense.id}/attachment` : null),
    attachment_name: expense.attachment_name ?? expense.attachment?.original_filename,
    attachment_type: expense.attachment_type ?? expense.attachment?.content_type,
    approvals: approvals ? approvals.map(normalizeApproval) : (expense.approvals || []).map(normalizeApproval),
    ai_analysis: expense.ai_analysis ?? null,
    amount: String(expense.amount),
  };
}
let departmentCache = null;
async function withDepartments(expenses) {
  departmentCache ||= await allPages('/departments');
  return expenses.map((expense) => normalizeExpense(expense, departmentCache));
}

async function allPages(path) {
  const items = [];
  let page = 1; let result;
  do {
    const separator = path.includes('?') ? '&' : '?';
    result = await request(`${path}${separator}page=${page}&size=${API_PAGE_SIZE}`);
    items.push(...result.items); page += 1;
  } while (result.items.length > 0 && items.length < result.total);
  return items;
}

export const financeApi = {
  departments: async () => {
    if (!USE_MOCK) return allPages('/departments');
    await sleep(); financeUser(); return structuredClone(financeDepartments);
  },
  categories: async () => {
    if (!USE_MOCK) return request('/categories');
    await sleep(); financeUser(); return structuredClone(demoCategories);
  },

  /** Every expense in the company (finance sees all departments). */
  async expenses({ status = '' } = {}) {
    if (!USE_MOCK) return withDepartments(await allPages(`/expenses${status ? `?status=${status}` : ''}`));
    await sleep(); financeUser();
    return structuredClone(companyData().filter((entry) => !status || entry.status === status)
      .sort((a, b) => b.expense_date.localeCompare(a.expense_date) || b.id - a.id));
  },

  /** One expense with its decision history, in the shape the review page uses. */
  async getExpense(id) {
    if (!USE_MOCK) {
      const [expense, approvals] = await Promise.all([request(`/expenses/${id}`), request(`/expenses/${id}/approvals`)]);
      departmentCache ||= await allPages('/departments');
      return normalizeExpense(expense, departmentCache, approvals);
    }
    await sleep(); financeUser();
    const expense = companyData().find((entry) => entry.id === Number(id));
    if (!expense) throw new ApiError('This expense could not be found.', 404);
    return structuredClone(expense);
  },

  /** Requests waiting at the finance step, oldest first so nothing waits too long. */
  async queue() {
    if (!USE_MOCK) return withDepartments(await allPages('/approvals/pending'));
    await sleep(); financeUser();
    return structuredClone(companyData().filter((entry) => entry.status === STATUS.PENDING_FINANCE)
      .sort((a, b) => a.expense_date.localeCompare(b.expense_date) || a.id - b.id));
  },

  /** Same shape as the backend's FinanceDashboard schema. */
  async dashboard() {
    if (!USE_MOCK) return request('/dashboard/finance');
    await sleep(); financeUser();
    const expenses = companyData();
    const approved = expenses.filter((entry) => entry.status === STATUS.APPROVED);
    const settings = readSettings();
    const period = monthOf(today());
    const currentBudgets = settings.budgets.filter((budget) => budget.period_type === 'monthly' && `${budget.year}-${String(budget.month).padStart(2, '0')}` === period);
    const totalBudget = sum(currentBudgets);
    const spentThisPeriod = sum(approved.filter((entry) => entry.expense_date.startsWith(period)));
    const months = new Map();
    approved.forEach((entry) => { const key = monthOf(entry.expense_date); months.set(key, money((months.get(key) || 0) + Number(entry.amount))); });
    const people = new Map();
    approved.forEach((entry) => { const current = people.get(entry.requester.id) || { user_id: entry.requester.id, full_name: entry.requester.full_name, total: 0 }; current.total = money(current.total + Number(entry.amount)); people.set(entry.requester.id, current); });
    return {
      company_total: sum(expenses).toFixed(2),
      approved_total: sum(approved).toFixed(2),
      pending_total: sum(expenses.filter((entry) => [STATUS.PENDING_MANAGER, STATUS.PENDING_FINANCE].includes(entry.status))).toFixed(2),
      rejected_total: sum(expenses.filter((entry) => entry.status === STATUS.REJECTED)).toFixed(2),
      total_budget: totalBudget.toFixed(2),
      remaining_budget: money(totalBudget - spentThisPeriod).toFixed(2),
      by_department: financeDepartments.map((entry) => ({ department_id: entry.id, department_name: entry.name, total: sum(approved.filter((item) => item.department.id === entry.id)).toFixed(2) }))
        .sort((a, b) => Number(b.total) - Number(a.total)),
      monthly: [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([key, total]) => ({ year: Number(key.slice(0, 4)), month: Number(key.slice(5)), total: total.toFixed(2) })),
      top_employees: [...people.values()].sort((a, b) => b.total - a.total).slice(0, 5).map((entry) => ({ ...entry, total: entry.total.toFixed(2) })),
    };
  },

  /** Finance step decision: approve (final) or reject (note required). */
  async decide(id, decision, note = '') {
    if (![DECISION.APPROVE, DECISION.REJECT].includes(decision)) throw new ApiError('Finance can approve or reject a request.');
    if (decision === DECISION.REJECT && !note.trim()) throw new ApiError('Add a note explaining why the request is rejected.');
    if (note.length > NOTE_MAX_LENGTH) throw new ApiError('The note exceeds the character limit.');
    if (!USE_MOCK) return request(`/approvals/${id}/${decision}`, { method: 'POST', body: { note: note.trim() } });
    await sleep(); const user = financeUser();
    const data = companyData();
    const expense = data.find((entry) => entry.id === Number(id));
    if (!expense) throw new ApiError('This expense could not be found.', 404);
    if (expense.status !== STATUS.PENDING_FINANCE) throw new ApiError('This request is no longer waiting for Finance. Refresh to see its latest status.', 409);
    if (decision === DECISION.APPROVE && !expense.attachment_url) throw new ApiError('A receipt is required before approval.', 422);
    expense.status = decision === DECISION.APPROVE ? STATUS.APPROVED : STATUS.REJECTED;
    expense.approvals.push({ id: Date.now(), actor_name: user.full_name, decision: expense.status, note: note.trim(), created_at: new Date().toISOString() });
    writeData(data);
    return structuredClone(expense);
  },

  async budgets({ year, month } = {}) {
    if (!USE_MOCK) {
      const items = await allPages(`/budgets${year ? `?year=${year}` : ''}`);
      return items.filter((budget) => !month || budget.period_type === 'annual' || budget.month === Number(month));
    }
    await sleep(); financeUser();
    return structuredClone(readSettings().budgets.filter((budget) => (!year || budget.year === Number(year)) && (!month || budget.period_type === 'annual' || budget.month === Number(month))));
  },
  async budgetUsage(budget) {
    if (!USE_MOCK) return request(`/budgets/${budget.id}/usage`);
    await sleep(); financeUser();
    return usageFor(budget, companyData());
  },
  async createBudget(payload) {
    const body = { department_id: Number(payload.department_id), period_type: payload.period_type, year: Number(payload.year), month: payload.period_type === 'monthly' ? Number(payload.month) : null, amount: String(payload.amount).trim() };
    validateBudget(body);
    if (!USE_MOCK) return request('/budgets', { method: 'POST', body });
    await sleep(); financeUser();
    const settings = readSettings();
    if (settings.budgets.some((budget) => budget.department_id === body.department_id && budget.period_type === body.period_type && budget.year === body.year && budget.month === body.month)) {
      throw new ApiError('This department already has a budget for that period. Edit it instead.', 409);
    }
    const budget = { id: Math.max(0, ...settings.budgets.map((entry) => entry.id)) + 1, ...body, amount: money(body.amount).toFixed(2) };
    settings.budgets.push(budget); writeSettings(settings); return structuredClone(budget);
  },
  async updateBudget(id, amount) {
    validateAmount(String(amount).trim(), 'Enter a budget amount greater than zero.');
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

  /** Category spending limits (backend: /policies, one policy per category). */
  async policies() {
    if (!USE_MOCK) return request('/policies');
    await sleep(); financeUser();
    return readSettings().policies.map((policy) => ({ id: policy.id, category: structuredClone(demoCategories.find((entry) => entry.id === policy.category_id)), is_allowed: policy.is_allowed, max_amount: policy.max_amount }));
  },
  /** Create or update the policy for one category. `max_amount` empty = no limit. */
  async savePolicy(categoryId, { is_allowed, max_amount }, existingId = null) {
    const limit = max_amount === '' || max_amount === null || max_amount === undefined ? null : String(max_amount).trim();
    if (limit !== null) validateAmount(limit, 'Enter a limit greater than zero, or leave it empty for no limit.');
    if (!USE_MOCK) {
      // PolicyUpdate treats null as "unchanged", so removing a limit means recreating the policy.
      if (existingId && limit === null) await request(`/policies/${existingId}`, { method: 'DELETE' });
      else if (existingId) return request(`/policies/${existingId}`, { method: 'PATCH', body: { is_allowed, max_amount: limit } });
      return request('/policies', { method: 'POST', body: { category_id: categoryId, is_allowed, max_amount: limit } });
    }
    await sleep(); financeUser();
    const settings = readSettings();
    let policy = settings.policies.find((entry) => entry.category_id === Number(categoryId));
    if (!policy) { policy = { id: Math.max(0, ...settings.policies.map((entry) => entry.id)) + 1, category_id: Number(categoryId) }; settings.policies.push(policy); }
    Object.assign(policy, { is_allowed: Boolean(is_allowed), max_amount: limit === null ? null : money(limit).toFixed(2) });
    writeSettings(settings); return structuredClone(policy);
  },

  /**
   * Next four weekly totals for one department (or the whole company when null).
   * PROPOSED contract — the backend has no forecast route yet; agree on it with the ML team.
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
