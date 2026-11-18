// Demo-only data for the Finance workspace. Every shape matches the backend schemas
// (FinanceDashboard, BudgetRead, BudgetUsage, PolicyRead) so switching to the real API
// only changes where the data comes from, not how the pages read it.
import { CURRENCY, STATUS } from '../utils/constants';
import { demoCategories, department as engineering } from './mockData';

export const FINANCE_STORAGE_KEY = 'masroof.finance.v1';
export const COMPANY_SEED_START_ID = 1000;

export const financeDepartments = [
  { id: 1, name: 'Operations' },
  { id: 2, name: engineering.name },
  { id: 3, name: 'Research & Development' },
  { id: 4, name: 'Finance' },
  { id: 5, name: 'Fleet & Logistics' },
  { id: 6, name: 'Projects' },
];

// Employees of the other departments. They cannot log in; they only own demo expenses.
const companyPeople = [
  { id: 31, full_name: 'فيصل القحطاني', department_id: 1 },
  { id: 32, full_name: 'Reem Alshehri', department_id: 1 },
  { id: 33, full_name: 'عبدالرحمن الدوسري', department_id: 3 },
  { id: 34, full_name: 'Huda Alzahrani', department_id: 3 },
  { id: 35, full_name: 'ماجد الغامدي', department_id: 4 },
  { id: 36, full_name: 'Turki Alharthi', department_id: 5 },
  { id: 37, full_name: 'نوف العنزي', department_id: 5 },
  { id: 38, full_name: 'Saad Almalki', department_id: 6 },
  { id: 39, full_name: 'لمى الشمري', department_id: 6 },
];

// Typical monthly spend per department, used to size the generated history.
const monthlyScale = { 1: 14000, 3: 6500, 4: 2600, 5: 11000, 6: 7000 };
const descriptions = {
  1: ['Customer meals and hospitality', 'ضيافة اجتماع العملاء', 'Printer toner and paper'],
  2: ['Software & subscriptions', 'Office supplies', 'Team training'],
  3: ['Lab consumables', 'اشتراك أداة تحليل البيانات', 'Conference registration'],
  4: ['Audit software licence', 'مستلزمات مكتبية للقسم'],
  5: ['Fuel and tolls — Dammam route', 'صيانة مركبة التوصيل', 'Vehicle tracking subscription'],
  6: ['Site visit — Riyadh project', 'تذاكر سفر لزيارة موقع المشروع', 'Project kickoff workshop'],
};

// Small deterministic random generator so the demo looks the same on every load.
function random(seed) {
  let value = seed;
  return () => { value = (value * 1664525 + 1013904223) % 4294967296; return value / 4294967296; };
}

const day = (date) => date.toISOString().slice(0, 10);
const addDays = (value, days) => { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return day(date); };

/** Expenses for the other departments, from 1 June until `endDate`. */
export function createCompanyExpenses(endDate) {
  const next = random(20261118);
  const expenses = [];
  let id = COMPANY_SEED_START_ID;
  let approvalId = 5000;
  const start = '2026-06-01';
  for (const person of companyPeople) {
    const departmentInfo = financeDepartments.find((entry) => entry.id === person.department_id);
    const peers = companyPeople.filter((entry) => entry.department_id === person.department_id).length;
    const perMonth = 6;
    const average = monthlyScale[person.department_id] / peers / perMonth;
    for (let date = start; date <= endDate; date = addDays(date, Math.max(2, Math.round(30 / perMonth + (next() - 0.5) * 4)))) {
      const amount = Math.max(45, Math.round(average * (0.35 + next() * 1.3) * 100) / 100);
      const category = demoCategories[Math.floor(next() * demoCategories.length)];
      const age = (new Date(`${endDate}T00:00:00Z`) - new Date(`${date}T00:00:00Z`)) / 86400000;
      const roll = next();
      const status = age <= 4 ? (roll < 0.55 ? STATUS.PENDING_FINANCE : STATUS.PENDING_MANAGER)
        : age <= 9 && roll < 0.35 ? STATUS.PENDING_FINANCE
          : roll < 0.08 ? STATUS.REJECTED : STATUS.APPROVED;
      const managerDay = addDays(date, 1);
      const approvals = status === STATUS.PENDING_MANAGER ? [] : [{ id: approvalId++, actor_name: 'Department manager', decision: STATUS.PENDING_FINANCE, note: '', created_at: `${managerDay}T09:15:00Z` }];
      if (status === STATUS.APPROVED || status === STATUS.REJECTED) approvals.push({ id: approvalId++, actor_name: 'Lina Hassan', decision: status, note: status === STATUS.REJECTED ? 'Duplicate of an earlier claim.' : '', created_at: `${addDays(date, 3)}T11:00:00Z` });
      const options = descriptions[person.department_id];
      const risky = status === STATUS.PENDING_FINANCE && roll > 0.85;
      expenses.push({
        id: id++, requester: { id: person.id, full_name: person.full_name, department_id: person.department_id },
        department: { ...departmentInfo }, category: { ...category }, amount: amount.toFixed(2), currency: CURRENCY,
        description: options[Math.floor(next() * options.length)], expense_date: date, status,
        attachment_url: 'demo-receipt', attachment_name: `receipt-${id - 1}.svg`, attachment_type: 'image/svg+xml',
        ai_analysis: risky ? { anomaly_score: 0.78, risk_level: 'High', warnings: ['Amount is well above this employee’s usual spend in this category.'] } : null,
        approvals, created_at: `${date}T08:20:00Z`,
      });
    }
  }
  return expenses;
}

/** Budgets and category limits, seeded for the current and previous month. */
export function createFinanceSettings(currentDay) {
  const [year, month] = currentDay.split('-').map(Number);
  const previous = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
  const amounts = { 1: 16000, 2: 6000, 3: 5000, 4: 4000, 5: 12000, 6: 9000 };
  let id = 1;
  const budgets = [];
  for (const period of [previous, { year, month }]) {
    for (const entry of financeDepartments) budgets.push({ id: id++, department_id: entry.id, period_type: 'monthly', year: period.year, month: period.month, amount: amounts[entry.id].toFixed(2) });
  }
  const limits = { 1: '1500.00', 3: '2500.00', 4: '1000.00', 5: '3000.00' };
  const policies = Object.entries(limits).map(([categoryId, maxAmount], index) => ({ id: index + 1, category_id: Number(categoryId), is_allowed: true, max_amount: maxAmount }));
  return { budgets, policies };
}

// Weekly totals per department in SAR, shaped like the output of ml/notebooks/forecasting.ipynb
// (Linear Regression, four weekly outputs, last-week baseline). Values are demo data only.
const FORECAST_SCALE = 0.3; // keeps forecast totals in line with the demo expense history
const rawForecastSeeds = {
  1: { history: [9146, 9559, 12111, 8368, 9878, 7798, 8449, 9765], predicted: [8539, 8157, 8547, 8217] },
  2: { history: [3504, 6298, 2625, 4319, 4523, 3068, 9899, 7067], predicted: [5261, 6307, 6824, 6083] },
  3: { history: [5177, 5155, 6191, 5361, 5114, 5540, 5107, 4481], predicted: [4931, 4990, 4813, 4745] },
  4: { history: [1523, 1189, 1301, 520, 799, 760, 598, 1096], predicted: [1073, 1059, 1158, 1261] },
  5: { history: [3434, 11305, 2404, 2363, 3623, 10913, 2265, 5409], predicted: [6435, 5592, 4853, 6105] },
  6: { history: [1314, 1208, 1171, 1605, 1685, 3214, 1680, 1912], predicted: [2399, 2369, 2190, 2443] },
};
const scale = (values) => values.map((value) => Math.round(value * FORECAST_SCALE * 100) / 100);
export const forecastSeeds = Object.fromEntries(Object.entries(rawForecastSeeds).map(([id, seed]) => [id, { history: scale(seed.history), predicted: scale(seed.predicted) }]));

/** Sunday that starts the week containing `value` (weeks run Sunday to Saturday). */
export function weekStart(value) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return day(date);
}
export { addDays };
