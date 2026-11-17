import { STATUS } from '../../utils/constants';
import { today } from '../../utils/formatters';

// Presentation-only demo allocation. The current backend contract exposes no budget.
export const DEMO_DEPARTMENT_ALLOCATION = 12000;
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_DAYS = 7;
const RECENT_WEEKS = 6;

export function weeklyApprovedSpend(expenses, endDate = today()) {
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(end.getTime())) return [];
  const monday = end.getTime() - ((end.getUTCDay() + WEEK_DAYS - 1) % WEEK_DAYS) * DAY_MS;
  const start = monday - (RECENT_WEEKS - 1) * WEEK_DAYS * DAY_MS;
  const weeks = Array.from({ length: RECENT_WEEKS }, (_, index) => ({
    date: new Date(start + index * WEEK_DAYS * DAY_MS).toISOString().slice(0, 10), amount: 0,
  }));
  expenses.forEach((expense) => {
    if (expense.status !== STATUS.APPROVED) return;
    const date = new Date(`${expense.expense_date}T00:00:00Z`).getTime();
    const amount = Number(expense.amount);
    if (!Number.isFinite(date) || date > end.getTime() || !Number.isFinite(amount) || amount < 0) return;
    const index = Math.floor((date - start) / (WEEK_DAYS * DAY_MS));
    if (index >= 0 && index < weeks.length) weeks[index].amount += amount;
  });
  return weeks.map((week) => ({ ...week, amount: Math.round(week.amount * 100) / 100 }));
}

export function sparklineGeometry(values) {
  const width = 180;
  const height = 48;
  const padding = 4;
  const amounts = values.map((value) => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0);
  const maximum = Math.max(0, ...amounts);
  const points = amounts.map((value, index) => ({
    x: amounts.length > 1 ? padding + index * (width - padding * 2) / (amounts.length - 1) : width / 2,
    y: maximum > 0 ? height - padding - value / maximum * (height - padding * 2) : height / 2,
  }));
  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(' ');
  const area = points.length ? `${line} L${points.at(-1).x},${height} L${points[0].x},${height} Z` : '';
  return { line, area, end: points.at(-1), maximum };
}
