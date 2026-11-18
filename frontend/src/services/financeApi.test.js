import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'fake-indexeddb/auto';
import { DECISION, STATUS } from '../utils/constants';
import { today } from '../utils/formatters';
import { DEMO_PASSWORD } from './mockData';

const storage = new Map();
vi.stubGlobal('localStorage', {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
});
vi.stubGlobal('window', new EventTarget());
const { api } = await import('./api');
const { financeApi } = await import('./financeApi');
const login = (username = 'finance') => api.login(username, DEMO_PASSWORD);

beforeEach(() => { storage.clear(); api.logout(); });

describe('finance access', () => {
  it('rejects employees and managers', async () => {
    await login('sara');
    await expect(financeApi.queue()).rejects.toMatchObject({ status: 403 });
    await login('khalid');
    await expect(financeApi.dashboard()).rejects.toMatchObject({ status: 403 });
  });
  it('lets finance open any department’s expense, including its receipt', async () => {
    await login();
    const [first] = await financeApi.queue();
    expect((await api.getExpense(first.id)).id).toBe(first.id);
  });
});

describe('payout queue decisions', () => {
  it('lists only pending_finance requests, oldest first', async () => {
    await login();
    const queue = await financeApi.queue();
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.every((expense) => expense.status === STATUS.PENDING_FINANCE)).toBe(true);
    expect(queue.map((expense) => expense.expense_date)).toEqual([...queue.map((expense) => expense.expense_date)].sort());
  });
  it('approves as final and records the finance decision', async () => {
    await login();
    const [first] = await financeApi.queue();
    const result = await financeApi.decide(first.id, DECISION.APPROVE, '');
    expect(result.status).toBe(STATUS.APPROVED);
    expect(result.approvals.at(-1)).toMatchObject({ decision: STATUS.APPROVED, actor_name: 'Lina Hassan' });
    expect((await financeApi.queue()).some((expense) => expense.id === first.id)).toBe(false);
    await expect(financeApi.decide(first.id, DECISION.REJECT, 'late')).rejects.toMatchObject({ status: 409 });
  });
  it('requires a note to reject and refuses request-changes', async () => {
    await login();
    const [first] = await financeApi.queue();
    await expect(financeApi.decide(first.id, DECISION.REJECT, '  ')).rejects.toThrow(/note/);
    await expect(financeApi.decide(first.id, DECISION.REQUEST_CHANGES, 'fix')).rejects.toThrow(/approve or reject/);
    expect((await financeApi.decide(first.id, DECISION.REJECT, 'Duplicate claim')).status).toBe(STATUS.REJECTED);
  });
  it('refuses to approve an expense without a receipt', async () => {
    await login();
    const [first] = await financeApi.queue();
    const data = JSON.parse(storage.get('masroof.demo.v1'));
    data.find((expense) => expense.id === first.id).attachment_url = null;
    storage.set('masroof.demo.v1', JSON.stringify(data));
    await expect(financeApi.decide(first.id, DECISION.APPROVE)).rejects.toMatchObject({ status: 422 });
  });
});

describe('dashboard', () => {
  it('matches the FinanceDashboard schema and adds up', async () => {
    await login();
    const dashboard = await financeApi.dashboard();
    expect(Object.keys(dashboard).sort()).toEqual(['approved_total', 'by_department', 'company_total', 'monthly', 'pending_total', 'rejected_total', 'remaining_budget', 'top_employees', 'total_budget']);
    const byDepartment = dashboard.by_department.reduce((sum, entry) => sum + Number(entry.total), 0);
    expect(byDepartment).toBeCloseTo(Number(dashboard.approved_total), 2);
    const monthly = dashboard.monthly.reduce((sum, entry) => sum + Number(entry.total), 0);
    expect(monthly).toBeCloseTo(Number(dashboard.approved_total), 2);
  });
});

describe('budgets', () => {
  it('creates, prevents duplicates, edits the amount, and deletes', async () => {
    await login();
    const year = Number(today().slice(0, 4)) + 1;
    const budget = await financeApi.createBudget({ department_id: 3, period_type: 'monthly', year, month: 2, amount: '7500' });
    expect(budget).toMatchObject({ department_id: 3, period_type: 'monthly', year, month: 2, amount: '7500.00' });
    await expect(financeApi.createBudget({ department_id: 3, period_type: 'monthly', year, month: 2, amount: '100' })).rejects.toMatchObject({ status: 409 });
    expect((await financeApi.updateBudget(budget.id, '8000.50')).amount).toBe('8000.50');
    await expect(financeApi.updateBudget(budget.id, '-1')).rejects.toThrow(/greater than zero/);
    await financeApi.deleteBudget(budget.id);
    expect((await financeApi.budgets({ year, month: 2 })).some((entry) => entry.id === budget.id)).toBe(false);
  });
  it('reports usage from approved spend in the budget period only', async () => {
    await login();
    const [year, month] = today().split('-').map(Number);
    const [budget] = await financeApi.budgets({ year, month });
    const usage = await financeApi.budgetUsage(budget);
    expect(Number(usage.remaining)).toBeCloseTo(Number(usage.budget_amount) - Number(usage.spent), 2);
    expect(usage.percent_used).toBeCloseTo(Number(usage.spent) / Number(usage.budget_amount) * 100, 0);
  });
});

describe('category limits', () => {
  it('saves a limit, clears it, and blocks a category', async () => {
    await login();
    await financeApi.savePolicy(2, { is_allowed: true, max_amount: '450' });
    expect((await financeApi.policies()).find((policy) => policy.category.id === 2)).toMatchObject({ is_allowed: true, max_amount: '450.00' });
    await financeApi.savePolicy(2, { is_allowed: false, max_amount: '' });
    expect((await financeApi.policies()).find((policy) => policy.category.id === 2)).toMatchObject({ is_allowed: false, max_amount: null });
    await expect(financeApi.savePolicy(2, { is_allowed: true, max_amount: 'abc' })).rejects.toThrow(/limit/);
  });
});

describe('forecast', () => {
  it('returns four Sunday-start weeks after eight weeks of history, plus the baseline', async () => {
    await login();
    const forecast = await financeApi.forecast(1);
    expect(forecast.weeks).toHaveLength(4);
    expect(forecast.history).toHaveLength(8);
    forecast.weeks.forEach((week) => expect(new Date(`${week.week_start}T00:00:00Z`).getUTCDay()).toBe(0));
    expect(forecast.baseline_last_week).toBe(forecast.history.at(-1).actual);
    const company = await financeApi.forecast(null);
    expect(Number(company.weeks[0].predicted)).toBeGreaterThan(Number(forecast.weeks[0].predicted));
  });
});

describe('backend response shapes', () => {
  it('normalizes a backend ExpenseRead and its ApprovalRead history for the pages', async () => {
    const { normalizeExpense } = await import('./financeApi');
    const backend = { id: 7, requester: { id: 3, username: 'sara.k', full_name: 'Sara' }, department_id: 2, category: { id: 1, name: 'Meals' }, amount: 120.5, currency: 'SAR', description: 'Lunch', expense_date: '2026-11-10', status: 'pending_finance', attachment: { id: 9, original_filename: 'r.jpg', content_type: 'image/jpeg' }, created_at: '2026-11-10T08:00:00Z' };
    const approvals = [{ id: 1, step: 'manager', decision: 'approved', approver: { full_name: 'Khalid' }, note: null, decided_at: '2026-11-11T09:00:00Z' }];
    const result = normalizeExpense(backend, [{ id: 2, name: 'Engineering' }], approvals);
    expect(result.department).toEqual({ id: 2, name: 'Engineering' });
    expect(result.attachment_url).toBeTruthy();
    expect(result.attachment_name).toBe('r.jpg');
    expect(result.amount).toBe('120.5');
    expect(result.approvals[0]).toMatchObject({ actor_name: 'Khalid', decision: STATUS.PENDING_FINANCE, note: '' });
    expect(normalizeExpense({ ...backend, attachment: null }).attachment_url).toBeNull();
  });
});

describe('annual budgets', () => {
  it('counts the whole year of approved spend', async () => {
    await login();
    const year = Number(today().slice(0, 4));
    const budget = await financeApi.createBudget({ department_id: 1, period_type: 'annual', year, month: 5, amount: '200000' });
    expect(budget.month).toBeNull();
    const monthly = (await financeApi.budgets({ year })).filter((entry) => entry.department_id === 1 && entry.period_type === 'monthly');
    const annual = await financeApi.budgetUsage(budget);
    const monthlySpent = await Promise.all(monthly.map((entry) => financeApi.budgetUsage(entry)));
    expect(Number(annual.spent)).toBeGreaterThanOrEqual(monthlySpent.reduce((sum, entry) => sum + Number(entry.spent), 0));
    expect((await financeApi.budgets({ year, month: 3 })).some((entry) => entry.id === budget.id)).toBe(true);
  });
});
