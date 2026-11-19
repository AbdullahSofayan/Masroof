import { API_PAGE_SIZE, CURRENCY, DECISION_STATUS, DECISIONS_REQUIRING_NOTE, DESCRIPTION_MAX_LENGTH, EDITABLE_STATUSES, MOCK_DELAY, NOTE_MAX_LENGTH, PERMISSIONS, SESSION_EXPIRED_EVENT, STATUS, STORAGE_KEYS, hasPermission, validateReceipt } from '../utils/constants';
import { today } from '../utils/formatters';
import { createDemoData, demoCategories, demoUsers, DEMO_PASSWORD } from './mockData';

export const USE_MOCK = true;
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
export class ApiError extends Error {
  constructor(message, status = 400) { super(message); this.name = 'ApiError'; this.status = status; }
}
let token = localStorage.getItem(STORAGE_KEYS.TOKEN);
export function setToken(value) {
  if (value) localStorage.setItem(STORAGE_KEYS.TOKEN, value);
  else localStorage.removeItem(STORAGE_KEYS.TOKEN);
  token = value;
}
export const getToken = () => token;
export const sleep = () => new Promise((resolve) => setTimeout(resolve, import.meta.env.MODE === 'test' ? 0 : MOCK_DELAY));
function expireSession() {
  setToken(null);
  window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}
export async function request(path, { method = 'GET', body, raw = false } = {}) {
  const headers = new Headers();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (body && !(body instanceof FormData) && !(body instanceof URLSearchParams)) headers.set('Content-Type', 'application/json');
  let response;
  try {
    response = await fetch(`${API_URL.replace(/\/$/, '')}${path}`, {
      method, headers, body: body instanceof FormData || body instanceof URLSearchParams ? body : body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
  } catch (error) {
    throw new ApiError(error.name === 'TimeoutError' ? 'The server took too long to respond. Please try again.' : 'Unable to reach the server. Check your connection and try again.', 0);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const message = Array.isArray(data.detail) ? data.detail.map((item) => `${item.loc?.at(-1) || 'Request'}: ${item.msg}`).join('; ') : data.detail || data.message || 'The request could not be completed.';
    if (response.status === 401 && path !== '/auth/login') expireSession();
    throw new ApiError(message, response.status);
  }
  if (raw) return response.blob();
  if (response.status === 204) return null;
  return response.json();
}
export function actor() {
  const user = demoUsers.find((entry) => token === `demo-token-${entry.id}`);
  if (!user) { expireSession(); throw new ApiError('Your session has expired. Please sign in again.', 401); }
  return user;
}
export function readData() {
  const stored = localStorage.getItem(STORAGE_KEYS.DATA);
  if (!stored) return createDemoData();
  try { const result = JSON.parse(stored); if (Array.isArray(result)) return result; } catch { /* Recover invalid demo storage. */ }
  return createDemoData();
}
export function writeData(data) {
  try { localStorage.setItem(STORAGE_KEYS.DATA, JSON.stringify(data)); }
  catch { throw new ApiError('Demo storage is full or unavailable. Free browser storage and try again.'); }
}
function assertView(user, expense) {
  const own = expense.requester.id === user.id && hasPermission(user, PERMISSIONS.OWN);
  const department = expense.department.id === user.department_id && hasPermission(user, PERMISSIONS.DEPARTMENT);
  if (!own && !department) throw new ApiError('You do not have access to this expense.', 403);
}
function assertEditable(user, expense) {
  if (expense.requester.id !== user.id || !hasPermission(user, PERMISSIONS.OWN)) throw new ApiError('Only the requester can change this expense.', 403);
  if (!EDITABLE_STATUSES.includes(expense.status)) throw new ApiError('This expense can no longer be edited.', 409);
}
function findExpense(data, id) {
  const expense = data.find((entry) => entry.id === Number(id));
  if (!expense) throw new ApiError('This expense could not be found.', 404);
  assertView(actor(), expense);
  return expense;
}
function validateExpense(payload) {
  if (!Number.isFinite(Number(payload.amount)) || Number(payload.amount) <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(payload.amount))) throw new ApiError('Enter a positive amount with no more than two decimal places.');
  if (!demoCategories.some((category) => category.id === Number(payload.category_id))) throw new ApiError('Choose a valid expense category.');
  if (!payload.description?.trim() || payload.description.trim().length > DESCRIPTION_MAX_LENGTH) throw new ApiError('Enter a description within the character limit.');
  const date = new Date(`${payload.expense_date}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== payload.expense_date || payload.expense_date > today()) throw new ApiError('Choose a valid expense date that is not in the future.');
}
function audit(expense, decision, note = '') {
  expense.approvals.push({ id: Date.now(), actor_name: actor().full_name, decision, note: note.trim(), created_at: new Date().toISOString() });
}
async function receiptStore(mode, action) {
  const db = await new Promise((resolve, reject) => {
    const open = indexedDB.open('masroof-receipts', 1);
    open.onupgradeneeded = () => open.result.createObjectStore('receipts');
    open.onsuccess = () => resolve(open.result);
    open.onerror = () => reject(new ApiError('Receipt storage is unavailable in this browser.'));
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction('receipts', mode);
      const operation = action(transaction.objectStore('receipts'));
      transaction.oncomplete = () => resolve(operation.result);
      transaction.onerror = () => reject(new ApiError('Unable to save or open the receipt. Please try again.'));
      transaction.onabort = () => reject(new ApiError('Receipt storage was interrupted. Please try again.'));
    });
  } finally { db.close(); }
}
export const api = {
  async login(username, password) {
    let result;
    if (USE_MOCK) {
      await sleep();
      const user = demoUsers.find((entry) => entry.username === username.trim() || entry.email === username.trim());
      if (!user || password !== DEMO_PASSWORD) throw new ApiError('The username or password is incorrect.', 401);
      result = { access_token: `demo-token-${user.id}`, token_type: 'bearer' };
    } else result = await request('/auth/login', { method: 'POST', body: new URLSearchParams({ username, password }) });
    setToken(result.access_token);
    try { return await api.me(); } catch (error) { setToken(null); throw error; }
  },
  async me() { if (!USE_MOCK) return request('/auth/me'); await sleep(); return structuredClone(actor()); },
  logout() { setToken(null); },
  async categories() { if (!USE_MOCK) return request('/categories'); await sleep(); actor(); return structuredClone(demoCategories); },
  async listExpenses({ page = 1, size = API_PAGE_SIZE, status = '', view = 'department' } = {}) {
    if (!USE_MOCK) {
      if (view === 'own') {
        // The backend scopes managers to their department. Filter their personal view before paginating.
        const user = await api.me();
        const all = await api.allExpenses({ status, view: 'department' });
        const own = all.filter((entry) => entry.requester.id === user.id);
        return { items: own.slice((page - 1) * size, page * size), total: own.length, page, size };
      }
      const query = new URLSearchParams({ page, size });
      if (status) query.set('status', status);
      return request(`/expenses?${query}`);
    }
    await sleep();
    const user = actor();
    if (!hasPermission(user, view === 'own' ? PERMISSIONS.OWN : PERMISSIONS.DEPARTMENT)) throw new ApiError('You do not have permission to view these expenses.', 403);
    const expenses = readData().filter((entry) => view === 'own' ? entry.requester.id === user.id : entry.department.id === user.department_id)
      .filter((entry) => !status || entry.status === status).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id - a.id);
    return { items: structuredClone(expenses.slice((page - 1) * size, page * size)), total: expenses.length, page, size };
  },
  async allExpenses(options = {}) {
    let page = 1;
    const items = [];
    let result;
    do {
      result = await api.listExpenses({ ...options, page, size: API_PAGE_SIZE });
      items.push(...result.items);
      page += 1;
    } while (result.items.length > 0 && items.length < result.total);
    return items;
  },
  async getExpense(id) {
    if (!USE_MOCK) return request(`/expenses/${id}`);
    await sleep(); return structuredClone(findExpense(readData(), id));
  },
  async createExpense(payload) {
    if (!USE_MOCK) return request('/expenses', { method: 'POST', body: payload });
    await sleep(); const user = actor();
    if (!hasPermission(user, PERMISSIONS.OWN)) throw new ApiError('You cannot submit expenses.', 403);
    validateExpense(payload);
    const data = readData();
    const expense = {
      id: Math.max(100, ...data.map((entry) => entry.id)) + 1, requester: structuredClone(user), department: structuredClone(user.department),
      category: { ...demoCategories.find((entry) => entry.id === Number(payload.category_id)) }, amount: Number(payload.amount).toFixed(2), currency: CURRENCY,
      description: payload.description.trim(), expense_date: payload.expense_date, status: STATUS.PENDING_MANAGER,
      attachment_url: null, ai_analysis: null, approvals: [], created_at: new Date().toISOString(),
    };
    data.unshift(expense); writeData(data); return structuredClone(expense);
  },
  async updateExpense(id, payload) {
    if (!USE_MOCK) return request(`/expenses/${id}`, { method: 'PATCH', body: payload });
    await sleep(); const data = readData(); const expense = findExpense(data, id); assertEditable(actor(), expense);
    const merged = { ...expense, category_id: expense.category.id, ...payload }; validateExpense(merged);
    Object.assign(expense, { amount: Number(merged.amount).toFixed(2), description: merged.description.trim(), expense_date: merged.expense_date, category: { ...demoCategories.find((entry) => entry.id === Number(merged.category_id)) } });
    // A changed request must never retain stale AI findings from its previous contents.
    expense.ai_analysis = null;
    writeData(data); return structuredClone(expense);
  },
  async deleteExpense(id) {
    if (!USE_MOCK) return request(`/expenses/${id}`, { method: 'DELETE' });
    await sleep(); const data = readData(); const expense = findExpense(data, id); assertEditable(actor(), expense);
    if (expense.attachment_url === 'stored-receipt') await receiptStore('readwrite', (store) => store.delete(Number(id)));
    writeData(data.filter((entry) => entry.id !== Number(id))); return null;
  },
  async resubmitExpense(id) {
    if (!USE_MOCK) return request(`/expenses/${id}/resubmit`, { method: 'POST' });
    await sleep(); const data = readData(); const expense = findExpense(data, id); assertEditable(actor(), expense);
    if (expense.status !== STATUS.NEEDS_CHANGES) throw new ApiError('Only returned expenses can be resubmitted.', 409);
    if (!expense.attachment_url) throw new ApiError('Attach a receipt before resubmitting.');
    expense.status = STATUS.PENDING_MANAGER; audit(expense, STATUS.PENDING_MANAGER, 'Updated and resubmitted for manager review.'); writeData(data); return structuredClone(expense);
  },
  async uploadReceipt(id, file) {
    const error = validateReceipt(file); if (error) throw new ApiError(error);
    if (!USE_MOCK) { const body = new FormData(); body.append('file', file); return request(`/expenses/${id}/attachment`, { method: 'POST', body }); }
    await sleep(); const data = readData(); const expense = findExpense(data, id); assertEditable(actor(), expense);
    await receiptStore('readwrite', (store) => store.put(file, Number(id)));
    expense.attachment_url = 'stored-receipt'; expense.attachment_name = file.name; expense.attachment_type = file.type;
    expense.ai_analysis = null; writeData(data); return structuredClone(expense);
  },
  async receipt(expense) {
    if (USE_MOCK) {
      const current = findExpense(readData(), expense.id);
      if (!current.attachment_url) throw new ApiError('No receipt is attached.');
      if (current.attachment_url === 'stored-receipt') {
        const blob = await receiptStore('readonly', (store) => store.get(current.id));
        if (!blob) throw new ApiError('The receipt is missing from this browser. Please upload it again.');
        return { url: URL.createObjectURL(blob), type: blob.type, name: current.attachment_name };
      }
      const escape = (value) => String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="740" viewBox="0 0 600 740"><rect width="600" height="740" fill="white"/><g font-family="Arial,sans-serif" fill="#334155"><text x="50" y="75" font-size="26" font-weight="bold">MASROOF DEMO RECEIPT</text><text x="50" y="110" font-size="14" fill="#64748b">Sample document · For demonstration only</text><path d="M50 145H550" stroke="#e2e8f0"/><text x="50" y="190" font-size="14">Receipt reference</text><text x="550" y="190" text-anchor="end" font-size="14">EXP-${current.id}</text><text x="50" y="235" font-size="14">Expense date</text><text x="550" y="235" text-anchor="end" font-size="14">${escape(current.expense_date)}</text><text x="50" y="280" font-size="14">Category</text><text x="550" y="280" text-anchor="end" font-size="14">${escape(current.category.name)}</text><path d="M50 320H550" stroke="#e2e8f0"/><text x="50" y="375" font-size="14">Description</text><foreignObject x="50" y="400" width="500" height="130"><div xmlns="http://www.w3.org/1999/xhtml" dir="auto" style="font-size:17px;line-height:1.8">${escape(current.description)}</div></foreignObject><rect x="50" y="560" width="500" height="85" rx="8" fill="#ecfdf5"/><text x="75" y="610" font-size="18" fill="#047857">TOTAL</text><text x="525" y="612" text-anchor="end" font-size="28" font-weight="bold" fill="#047857">${CURRENCY} ${escape(current.amount)}</text><text x="300" y="700" text-anchor="middle" font-size="12" fill="#94a3b8">This sample is not a tax invoice.</text></g></svg>`;
      return { url: URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), type: 'image/svg+xml', name: current.attachment_name };
    }
    // Always use the authenticated API endpoint; never expose the bearer token in a URL.
    const blob = await request(`/expenses/${expense.id}/attachment`, { raw: true });
    return { url: URL.createObjectURL(blob), type: blob.type, name: expense.attachment_name || `receipt-${expense.id}` };
  },
  async decide(id, decision, note = '') {
    if (!Object.hasOwn(DECISION_STATUS, decision)) throw new ApiError('Invalid decision.');
    if (DECISIONS_REQUIRING_NOTE.includes(decision) && !note.trim()) throw new ApiError('Add a note for the employee before submitting this decision.');
    if (note.length > NOTE_MAX_LENGTH) throw new ApiError('The note exceeds the character limit.');
    if (!USE_MOCK) return request(`/expenses/${id}/${decision}`, { method: 'POST', body: { note: note.trim() } });
    await sleep(); const data = readData(); const expense = findExpense(data, id); const user = actor();
    if (!hasPermission(user, PERMISSIONS.DEPARTMENT) || expense.department.id !== user.department_id) throw new ApiError('Only a manager in this department can review this expense.', 403);
    if (expense.requester.id === user.id) throw new ApiError('Your own expenses must be reviewed by another manager.', 403);
    if (expense.status !== STATUS.PENDING_MANAGER) throw new ApiError('This request has already left the manager queue. Refresh to see its latest status.', 409);
    expense.status = DECISION_STATUS[decision]; audit(expense, expense.status, note); writeData(data); return structuredClone(expense);
  },
};
