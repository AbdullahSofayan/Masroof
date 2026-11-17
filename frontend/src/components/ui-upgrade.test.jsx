// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gsap } from 'gsap';
import Navbar from './Navbar';
import ApprovalTimeline from './ApprovalTimeline';
import SummaryCards from './SummaryCards';
import AnimatedContent from './reactbits/AnimatedContent';
import CountUp from './reactbits/CountUp';
import SpotlightCard from './reactbits/SpotlightCard';
import Squares from './reactbits/Squares';
import EmployeeDashboard from '../pages/employee/EmployeeDashboard';
import MyExpensesPage from '../pages/employee/MyExpensesPage';
import ManagerDashboard from '../pages/manager/ManagerDashboard';
import ExpenseReviewPage from '../pages/manager/ExpenseReviewPage';
import LoginPage from '../pages/LoginPage';
import { api } from '../services/api';
import { createDemoData, demoUsers } from '../services/mockData';
import { DECISION, PAGE_SIZE, STATUS } from '../utils/constants';

const state = vi.hoisted(() => ({ user: null }));
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: state.user, loading: false, error: '', logout: vi.fn(), login: vi.fn() }),
}));
vi.mock('../context/NoticeContext', () => ({ useNotice: () => vi.fn() }));
vi.mock('./ReceiptViewer', () => ({ default: () => <div>Receipt preview</div> }));

let host;
let root;
const browserRequestFrame = window.requestAnimationFrame.bind(window);
const browserCancelFrame = window.cancelAnimationFrame.bind(window);
beforeEach(() => {
  // Stop GSAP's shared ticker before tests remove frame APIs or change the clock.
  vi.stubGlobal('cancelAnimationFrame', browserCancelFrame);
  gsap.ticker.sleep();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', undefined);
  vi.stubGlobal('cancelAnimationFrame', undefined);
  vi.stubGlobal('IntersectionObserver', undefined);
  vi.stubGlobal('ResizeObserver', undefined);
  vi.stubGlobal('matchMedia', undefined);
  vi.stubGlobal('CanvasRenderingContext2D', undefined);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  state.user = demoUsers.find((user) => user.username === 'sara');
});
afterEach(async () => {
  await act(async () => root.unmount());
  // Stop the real-animation test's shared ticker before restoring unavailable frame APIs.
  vi.stubGlobal('cancelAnimationFrame', browserCancelFrame);
  gsap.ticker.sleep();
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
async function render(element) { await act(async () => { root.render(element); }); }
function router(element, path = '/') { return <MemoryRouter initialEntries={[path]}>{element}</MemoryRouter>; }
const button = (label) => [...host.querySelectorAll('button')].find((node) => node.getAttribute('aria-label') === label || node.textContent.trim() === label)
  || [...host.querySelectorAll('button')].find((node) => node.textContent.includes(label));
async function input(node, value) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(node), 'value').set;
  await act(async () => { setter.call(node, value); node.dispatchEvent(new Event('input', { bubbles: true })); });
}

describe('UI behavior with unavailable browser animation APIs', () => {
  it('opens the employee expense history from the accessible category header button', async () => {
    vi.spyOn(api, 'allExpenses').mockResolvedValue(createDemoData().filter((expense) => expense.requester.id === state.user.id));
    await render(router(<Routes><Route path="/employee/dashboard" element={<EmployeeDashboard />} /><Route path="/employee/expenses" element={<p>Employee expense destination</p>} /></Routes>, '/employee/dashboard'));
    const view = button('View expenses by category');
    expect(view.type).toBe('button');
    expect(view.title).toBe('View expenses by category');
    await act(async () => view.click());
    expect(host.textContent).toBe('Employee expense destination');
  });

  it('filters employee rows by category with click and keyboard toggles, scrolls, and clears the category pill', async () => {
    const expenses = createDemoData().filter((expense) => expense.requester.id === state.user.id);
    vi.spyOn(api, 'allExpenses').mockResolvedValue(expenses);
    await render(router(<EmployeeDashboard />));
    const ledger = host.querySelector('#employee-expenses');
    const scroll = vi.fn(); ledger.scrollIntoView = scroll;
    await act(async () => host.querySelector('[aria-label="Next page"]').click());
    const category = host.querySelector('[aria-label="Filter by Travel & transport"]');
    expect(category.getAttribute('role')).toBe('button');
    expect(category.tabIndex).toBe(0);
    await act(async () => category.click());
    expect(category.getAttribute('aria-pressed')).toBe('true');
    expect(scroll).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' });
    const expected = expenses.filter((expense) => expense.category.name === 'Travel & transport');
    expect(host.querySelectorAll('tbody tr')).toHaveLength(expected.length);
    expect([...host.querySelectorAll('tbody tr')].every((row) => row.textContent.includes('Travel & transport'))).toBe(true);
    expect(ledger.textContent).toContain(`1–${expected.length} of ${expected.length} expenses`);
    expect(button('Clear category filter').textContent).toContain('Category: Travel & transport');
    await act(async () => category.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
    expect(category.getAttribute('aria-pressed')).toBe('false');
    expect(host.querySelector('[aria-label="Clear category filter"]')).toBeNull();
    expect(host.querySelectorAll('tbody tr')).toHaveLength(PAGE_SIZE);
    await act(async () => category.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true })));
    expect(category.getAttribute('aria-pressed')).toBe('true');
    await act(async () => button('Clear category filter').click());
    expect(category.getAttribute('aria-pressed')).toBe('false');
    expect(host.querySelectorAll('tbody tr')).toHaveLength(PAGE_SIZE);
    expect(host.querySelector('[aria-label="Clear category filter"]')).toBeNull();
  });

  it('combines manager category/status filters and clears both from the header, respecting reduced motion and self-review isolation', async () => {
    state.user = demoUsers.find((user) => user.username === 'khalid');
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const expenses = createDemoData();
    vi.spyOn(api, 'allExpenses').mockResolvedValue(expenses);
    await render(router(<ManagerDashboard />));
    const ledger = host.querySelector('#department-expenses');
    const scroll = vi.fn(); ledger.scrollIntoView = scroll;
    const category = host.querySelector('[aria-label="Filter by Software & subscriptions"]');
    await act(async () => category.click());
    expect(scroll).toHaveBeenLastCalledWith({ behavior: 'auto', block: 'start' });
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(host.querySelector('tbody').textContent).toContain('EXP-102');
    await act(async () => button('Approved').click());
    expect(host.querySelectorAll('tbody tr')).toHaveLength(1);
    expect(host.querySelector('tbody').textContent).toContain('EXP-105');
    await act(async () => button('View expenses by category').click());
    expect(category.getAttribute('aria-pressed')).toBe('false');
    expect(button('All').getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('[aria-label="Clear category filter"]')).toBeNull();
    expect(host.querySelectorAll('tbody tr')).toHaveLength(PAGE_SIZE);
    expect(ledger.textContent).toContain('1–6 of 13 expenses');
    expect(host.querySelector('a[href="/manager/expenses/112"]')).toBeNull();
    await act(async () => host.querySelector('[aria-label="Next page"]').click());
    await act(async () => button('View expenses by category').click());
    expect(ledger.textContent).toContain('1–6 of 13 expenses');
    expect(scroll).toHaveBeenCalledTimes(3);
  });

  it('recalculates every hero metric and allocation for Daily, Weekly and All time using Riyadh calendar days', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-17T09:00:00Z'));
    const expenses = [
      { date: '2026-11-17', amount: '100', status: STATUS.APPROVED },
      { created_at: '2026-11-16T22:30:00Z', amount: '20', status: STATUS.PENDING_MANAGER },
      { date: '2026-11-11', amount: '30', status: STATUS.NEEDS_CHANGES },
      { date: '2026-11-10', amount: '40', status: STATUS.APPROVED },
      { date: '2026-11-18', amount: '50', status: STATUS.APPROVED },
      { date: 'invalid', amount: '60', status: STATUS.REJECTED },
      { date: '2026-11-16', created_at: '2026-11-17T09:00:00Z', amount: '70', status: STATUS.PENDING_FINANCE },
    ];
    await render(<SummaryCards expenses={expenses} />);
    const headline = () => host.querySelector('.hero-number .sr-only').textContent;
    const metrics = () => [...host.querySelectorAll('.hero-metrics .sr-only')].map((node) => node.textContent);
    const allocations = () => [...host.querySelectorAll('.hero-allocation > span')].map((node) => parseFloat(node.style.width));
    expect(host.querySelector('[role="group"][aria-label="Spend timeframe"]')).not.toBeNull();
    expect(button('All time').getAttribute('aria-pressed')).toBe('true');
    expect(headline()).toBe('370.00');
    expect(metrics()).toEqual(['190.00', '90.00', '30.00', '43%']);
    await act(async () => button('Daily').click());
    expect(button('Daily').getAttribute('aria-pressed')).toBe('true');
    expect(button('All time').getAttribute('aria-pressed')).toBe('false');
    expect(headline()).toBe('120.00');
    expect(host.querySelector('.hero-request-count').textContent).toContain('2 requests');
    expect(metrics()).toEqual(['100.00', '20.00', '0.00', '50%']);
    expect(allocations()[0]).toBeCloseTo(100 / 120 * 100);
    expect(allocations()[2]).toBe(0);
    await act(async () => button('Weekly').click());
    expect(button('Weekly').getAttribute('aria-pressed')).toBe('true');
    expect(button('Daily').getAttribute('aria-pressed')).toBe('false');
    expect(headline()).toBe('220.00');
    expect(host.querySelector('.hero-request-count').textContent).toContain('4 requests');
    expect(metrics()).toEqual(['100.00', '90.00', '30.00', '25%']);
    expect(allocations()[2]).toBeCloseTo(30 / 220 * 100);
    await act(async () => button('All time').click());
    expect(headline()).toBe('370.00');
    expect(host.querySelector('.hero-request-count').textContent).toContain('7 requests');
    expect(metrics()).toEqual(['190.00', '90.00', '30.00', '43%']);
  });

  it('shows zero final values for a timeframe without matching expenses', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-17T09:00:00Z'));
    await render(<SummaryCards expenses={[{ date: '2026-10-01', amount: '75', status: STATUS.APPROVED }]} />);
    await act(async () => button('Daily').click());
    expect(host.querySelector('.hero-number .sr-only').textContent).toBe('0.00');
    expect(host.querySelector('.hero-request-count').textContent).toContain('0 requests');
    expect([...host.querySelectorAll('.hero-metrics .sr-only')].map((node) => node.textContent)).toEqual(['0.00', '0.00', '0.00', '0%']);
    expect(host.innerHTML).not.toMatch(/NaN|Infinity/);
  });

  it('distinguishes rejection and returned timeline entries while preserving intact Arabic notes', async () => {
    const decisions = [STATUS.APPROVED, STATUS.REJECTED, STATUS.NEEDS_CHANGES, DECISION.REJECT, DECISION.REQUEST_CHANGES];
    await render(<ApprovalTimeline createdAt="2026-11-15" requesterName="سارة العتيبي" approvals={decisions.map((decision, id) => ({
      id, decision, actor_name: 'خالد المنصور', note: 'يرجى تحديث الإيصال', created_at: '2026-11-16',
    }))} />);
    const dots = [...host.querySelectorAll('.timeline-dot')];
    expect(dots.map((dot) => dot.querySelector('svg').classList.contains('lucide-check'))).toEqual([true, true, false, false, false, false]);
    for (const index of [2, 4]) {
      expect(dots[index].classList.contains('text-rose-600')).toBe(true);
      expect(dots[index].querySelector('.lucide-x')).not.toBeNull();
    }
    for (const index of [3, 5]) {
      expect(dots[index].classList.contains('text-amber-600')).toBe(true);
      expect(dots[index].querySelector('.lucide-rotate-ccw')).not.toBeNull();
    }
    expect(host.querySelector('p[dir="auto"]').textContent).toBe('سارة العتيبي');
    expect([...host.querySelectorAll('p[dir="auto"]')].every((node) => node.children.length === 0)).toBe(true);
  });

  it('excludes the manager’s own expense from review links and the pending count, retaining department totals', async () => {
    state.user = demoUsers.find((user) => user.username === 'khalid');
    const expenses = createDemoData();
    vi.spyOn(api, 'allExpenses').mockResolvedValue(expenses);
    await render(router(<ManagerDashboard />));
    const countCard = host.querySelector('[aria-label="Awaiting review"]');
    const pending = expenses.filter((entry) => entry.status === STATUS.PENDING_MANAGER && entry.requester.id !== state.user.id);
    expect(countCard.querySelector('.sr-only').textContent).toBe(String(pending.length));
    expect(host.querySelectorAll('tbody tr')).toHaveLength(pending.length);
    expect(host.querySelector('a[href="/manager/expenses/112"]')).toBeNull();
    await act(async () => button('All').click());
    expect(host.querySelector('a[href="/manager/expenses/112"]')).toBeNull();
    expect(host.textContent).toContain('Final approvals only · All time');
  });

  it.each(['99', '-2', '0', '1.5', 'invalid', 'Infinity'])('clamps employee pagination for page=%s and displays actual rows', async (rawPage) => {
    const expenses = createDemoData().filter((entry) => entry.requester.id === state.user.id).slice(0, PAGE_SIZE);
    const list = vi.spyOn(api, 'listExpenses').mockImplementation(async ({ page, size }) => ({
      items: expenses.slice((page - 1) * size, page * size), total: expenses.length, page, size,
    }));
    await render(router(<MyExpensesPage />, `/employee/expenses?page=${rawPage}`));
    expect(host.textContent).toContain(`1–${expenses.length} of ${expenses.length} expenses`);
    expect(host.textContent).toContain('1 / 1');
    expect(host.querySelectorAll('tbody tr')).toHaveLength(expenses.length);
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));
    expect(host.querySelector('[aria-label="Next page"]').disabled).toBe(true);
  });

  it('clamps to the final available employee page rather than resetting to the first', async () => {
    const expenses = createDemoData().filter((entry) => entry.requester.id === state.user.id);
    vi.spyOn(api, 'listExpenses').mockImplementation(async ({ page, size }) => ({
      items: expenses.slice((page - 1) * size, page * size), total: expenses.length, page, size,
    }));
    await render(router(<MyExpensesPage />, '/employee/expenses?page=99'));
    expect(host.textContent).toContain(`7–${expenses.length} of ${expenses.length} expenses`);
    expect(host.textContent).toContain('2 / 2');
    expect(host.querySelectorAll('tbody tr')).toHaveLength(expenses.length - PAGE_SIZE);
  });

  it('shows a valid first page for empty employee results', async () => {
    vi.spyOn(api, 'listExpenses').mockResolvedValue({ items: [], total: 0, page: 99, size: PAGE_SIZE });
    await render(router(<MyExpensesPage />, '/employee/expenses?page=99'));
    expect(host.textContent).toContain('0 expenses');
    expect(host.textContent).toContain('1 / 1');
    expect(host.querySelector('[aria-label="Previous page"]').disabled).toBe(true);
  });

  it('deletes from the drawer with one navigation that clears expense and page together', async () => {
    const expenses = createDemoData().filter((entry) => entry.requester.id === state.user.id && entry.status === STATUS.PENDING_MANAGER);
    let deleted = false;
    vi.spyOn(api, 'listExpenses').mockImplementation(async ({ page, size }) => ({ items: deleted ? [] : expenses, total: deleted ? 0 : expenses.length, page, size }));
    vi.spyOn(api, 'getExpense').mockResolvedValue(expenses[0]);
    const remove = vi.spyOn(api, 'deleteExpense').mockImplementation(async () => { deleted = true; });
    const navigations = [];
    function LocationProbe() {
      const location = useLocation();
      return <output ref={() => { if (navigations.at(-1) !== location.search) navigations.push(location.search); }}>{location.search}</output>;
    }
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((...args) => {
      const element = createElement(...args);
      if (args[0] === 'dialog') Object.assign(element, { showModal: vi.fn(), close: vi.fn() });
      return element;
    });
    const initial = `?status=${STATUS.PENDING_MANAGER}&page=2&expense=${expenses[0].id}&keep=value`;
    await render(router(<><MyExpensesPage /><LocationProbe /></>, `/employee/expenses${initial}`));
    await act(async () => button('Delete').click());
    await act(async () => button('Yes, delete expense').click());
    expect(remove).toHaveBeenCalledWith(String(expenses[0].id));
    expect(navigations).toEqual([initial, `?status=${STATUS.PENDING_MANAGER}&keep=value`]);
    expect(host.querySelector('dialog')).toBeNull();
    expect(host.textContent).toContain('0 expenses');
  });

  it('requires a receipt for approval while allowing note-backed rejection and changes', async () => {
    state.user = demoUsers.find((user) => user.username === 'khalid');
    vi.spyOn(api, 'getExpense').mockResolvedValue({ ...createDemoData()[0], attachment_url: null });
    const decide = vi.spyOn(api, 'decide').mockResolvedValue({});
    await render(router(<Routes><Route path="/manager/expenses/:id" element={<ExpenseReviewPage />} /></Routes>, '/manager/expenses/101'));
    expect(button('Approve expense').disabled).toBe(true);
    expect(host.textContent).toContain('Receipt attachment required before approval');
    await act(async () => button('Approve expense').click());
    expect(decide).not.toHaveBeenCalled();
    await input(host.querySelector('#manager-note'), 'يرجى إرفاق الإيصال');
    expect(button('Reject expense').disabled).toBe(false);
    expect(button('Request changes').disabled).toBe(false);
    await act(async () => button('Request changes').click());
    expect(decide).toHaveBeenCalledWith('101', DECISION.REQUEST_CHANGES, 'يرجى إرفاق الإيصال');
  });

  it('shows a static single-role workspace label and preserves managers’ two choices', async () => {
    await render(router(<Navbar />));
    expect(host.querySelector('select#workspace')).toBeNull();
    expect(host.querySelector('.workspace-badge').textContent).toBe('Employee workspace');
    state.user = demoUsers.find((user) => user.username === 'khalid');
    await render(router(<Navbar />));
    const select = host.querySelector('select#workspace');
    expect([...select.options].map((option) => option.text)).toEqual(['Employee workspace', 'Manager workspace']);
    await act(async () => { select.value = 'manager'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(host.querySelector('#workspace').value).toBe('manager');
  });

  it('renders final numeric values and intact Arabic content without observers, RAF, or canvas', async () => {
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    await render(<><CountUp to={4592.75} decimals={2} separator="," trigger="load" />
      <CountUp to={0} decimals={2} /><CountUp to={NaN} decimals={0} />
      <AnimatedContent delay={0.18} distance={16} duration={0.45}><p dir="auto">سارة العتيبي</p></AnimatedContent>
      <button type="button">Continue</button>
      <Squares /><SpotlightCard className="card">Summary</SpotlightCard></>);
    expect([...host.querySelectorAll('.sr-only')].map((node) => node.textContent)).toEqual(['4,592.75', '0.00', '0']);
    expect(host.textContent).not.toMatch(/NaN|Infinity/);
    const arabic = host.querySelector('p[dir="auto"]');
    expect(arabic.textContent).toBe('سارة العتيبي');
    expect(arabic.children.length).toBe(0);
    expect(arabic.parentElement.classList.contains('invisible')).toBe(false);
    expect(getContext).not.toHaveBeenCalled();
  });

  it('honors reduced motion with immediate final values and no scheduled animations', async () => {
    const requestFrame = vi.fn();
    vi.stubGlobal('requestAnimationFrame', requestFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
    await render(<><CountUp to={1450} decimals={2} separator="," trigger="load" />
      <AnimatedContent><p>Visible content</p></AnimatedContent>
      <SpotlightCard>Static card</SpotlightCard><Squares />
      <button>Approve</button></>);
    await act(async () => button('Approve').click());
    expect(host.querySelector('.sr-only').textContent).toBe('1,450.00');
    expect(host.textContent).toContain('Visible content');
    expect(requestFrame).not.toHaveBeenCalled();
    expect(getContext).not.toHaveBeenCalled();
  });

  it('completes real counter and entrance animations when browser APIs are available', async () => {
    vi.stubGlobal('requestAnimationFrame', browserRequestFrame);
    vi.stubGlobal('cancelAnimationFrame', browserCancelFrame);
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
    vi.stubGlobal('IntersectionObserver', class {
      observe() {}
      disconnect() {}
    });
    const countDone = vi.fn();
    const entranceDone = vi.fn();
    await render(<><CountUp to={4592.75} decimals={2} separator="," trigger="load" duration={0.02} onEnd={countDone} />
      <AnimatedContent trigger="mount" distance={12} duration={0.02} onComplete={entranceDone}><p dir="auto">سارة العتيبي</p></AnimatedContent></>);
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 180)); });
    expect(countDone).toHaveBeenCalled();
    expect(entranceDone).toHaveBeenCalled();
    expect(host.querySelector('p').parentElement.style.opacity).toBe('1');
  });

  it('renders dynamic employee totals in one bento hero and preserves the filtered changes link', async () => {
    const expenses = createDemoData().filter((expense) => expense.requester.id === state.user.id);
    vi.spyOn(api, 'allExpenses').mockResolvedValue(expenses);
    await render(router(<EmployeeDashboard />));
    const total = expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
    expect(host.textContent).toContain(total.toLocaleString('en-US', { minimumFractionDigits: 2 }));
    expect(host.querySelectorAll('[data-spotlight-card]')).toHaveLength(1);
    expect(host.querySelectorAll('.hero-metrics > div')).toHaveLength(4);
    expect(host.querySelector('[aria-label="Spend by Category"]').textContent).toContain('Average claim');
    const callout = [...host.querySelectorAll('a')].find((node) => node.textContent.includes('A quick update is needed'));
    expect(callout.getAttribute('href')).toBe(`/employee/expenses?status=${STATUS.NEEDS_CHANGES}`);
    expect(host.querySelector('canvas')).toBeNull();
  });

  it('keeps note-required decisions disabled for blank notes and leaves Approve available', async () => {
    state.user = demoUsers.find((user) => user.username === 'khalid');
    vi.spyOn(api, 'getExpense').mockResolvedValue(createDemoData()[0]);
    const decide = vi.spyOn(api, 'decide').mockResolvedValue({});
    await render(router(<Routes><Route path="/manager/expenses/:id" element={<ExpenseReviewPage />} /></Routes>, '/manager/expenses/101'));
    expect(button('Reject expense').disabled).toBe(true);
    expect(button('Request changes').disabled).toBe(true);
    expect(button('Approve expense').disabled).toBe(false);
    await input(host.querySelector('#manager-note'), '   ');
    expect(button('Reject expense').disabled).toBe(true);
    await input(host.querySelector('#manager-note'), 'يرجى توضيح تفاصيل الرحلة');
    expect(button('Reject expense').disabled).toBe(false);
    expect(button('Request changes').disabled).toBe(false);
    await act(async () => button('Approve expense').click());
    expect(decide).toHaveBeenCalledWith('101', DECISION.APPROVE, 'يرجى توضيح تفاصيل الرحلة');
  });

  it('only puts the decorative grid on login and keeps demo cards native buttons', async () => {
    state.user = null;
    await render(router(<LoginPage />));
    expect(host.querySelectorAll('canvas')).toHaveLength(1);
    expect(host.querySelector('canvas').getAttribute('aria-hidden')).toBe('true');
    expect(button('Demo Employee').hasAttribute('data-spotlight-card')).toBe(true);
    expect(button('Demo Manager').hasAttribute('data-spotlight-card')).toBe(true);
    expect(button('Demo Employee').type).toBe('button');
  });
});
