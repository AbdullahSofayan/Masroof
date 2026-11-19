# Masroof frontend

React + JavaScript, Vite, React Router, Tailwind CSS, and Lucide. This checkout implements Login, Employee, and Manager screens. `/finance/dashboard` is a protected handoff placeholder; Finance features are intentionally left to the Finance frontend teammate.

## Run locally

Use Node.js 22.12+ (Node 24 recommended) and npm.

```sh
cd frontend
npm ci
npm run dev
```

Open the local URL printed by Vite. Production output is written to `frontend/dist/`:

```sh
npm test
npm run build
npm run preview
```

`package-lock.json` records the installed versions. `node_modules/`, `dist/`, the local npm cache, and environment files are ignored.

## Demo accounts

`USE_MOCK = true` in `src/services/api.js`. All accounts use the password `Masroof123!`; usernames or the listed email addresses both work.

| Username | Email | Workspace |
| --- | --- | --- |
| sara | sara@company.sa | Employee — سارة العتيبي |
| khalid | khalid@company.sa | Manager and personal Employee view — خالد المنصور |
| omar | omar@company.sa | Employee — Omar Alharbi |
| noura | noura@company.sa | Employee — نورة القحطاني |
| finance | finance@company.sa | Finance placeholder — Lina Hassan |

The bilingual demo includes all five statuses, returned requests, manager/Finance notes, Arabic descriptions, and nullable AI analysis. Requests and decisions are persisted to localStorage, and uploaded receipts are stored as Blobs in IndexedDB. Logout preserves demo changes so you can switch accounts and demonstrate a complete workflow. Demo receipts are generated sample documents for each expense and clearly marked as non-tax-invoices. They are not real company documents.

To reset the demo, remove the `masroof.demo.v1` localStorage entry and the `masroof-receipts` IndexedDB database using browser developer tools, then reload. Receipts and saved data are local to this browser and origin. The demo is not a concurrent multi-user backend.

## Available screens

| Route | Purpose |
| --- | --- |
| `/login` | Password login and mock-only demo buttons |
| `/employee/dashboard` | Personal status counts, SAR totals, and recent requests |
| `/employee/expenses` | Paginated history, status filter, detail drawer, delete and resubmit |
| `/employee/expenses/new` | Submit a request with one receipt |
| `/employee/expenses/:id/edit` | Edit eligible pending/returned requests; save and resubmit |
| `/manager/dashboard` | Department totals, pending queue, and department history |
| `/manager/expenses/:id` | Two-column receipt/details review, AI warnings, audit history, decisions |
| `/finance/dashboard` | Finance teammate’s protected placeholder |

Managers can switch to their personal Employee workspace without changing accounts. Employee routes require `expenses.view_own`; Manager routes require `expenses.view_department`. The Finance placeholder accepts a `finance_admin` role, `expenses.view_all`, or a superuser. Confirm the Finance permission name with the backend team before replacing this placeholder. Route guards and mock service checks enforce access separately. Managers cannot review their own requests in the demo.

All statuses, badge colors, currency, file types/limits, and note rules are centralized in `src/utils/constants.js`. Amounts, counters, and dates use tabular numerals; user-authored text uses automatic text direction. Uploads accept one nonempty JPG, PNG, or PDF up to 5 MB. Reject and Request Changes require a trimmed nonempty note in both the UI and mock service. AI warnings are advisory and omitted when the analysis is null.

## Connect FastAPI

1. Set `USE_MOCK = false` in `src/services/api.js`.
2. Optionally create an ignored `frontend/.env.local` with `VITE_API_URL=http://localhost:8000/api/v1`. This is also the default URL. Restart Vite after changing environment variables.
3. Allow the local frontend origin in FastAPI CORS and use actual backend credentials. Mock demo buttons disappear when mock mode is off. Clear a stored demo session by logging out before signing in to the backend.

All HTTP requests live in `src/services/api.js`. Login sends form-encoded `username` and `password` to `/auth/login`, then requests `/auth/me`. Subsequent JSON and multipart requests attach the bearer token. A 401 clears the session; network and server validation errors are displayed with retry actions. A failed profile load retains the token for a retry unless the server reports 401.

The service uses exactly the documented expense CRUD, category, resubmit and decision endpoints. Receipt upload uses `POST /expenses/{id}/attachment` with one multipart `file`; preview/download uses authenticated `GET /expenses/{id}/attachment` and a revocable Blob URL. If the backend team selects `/receipt` instead, update these two paths in the service. File limits here are frontend defaults; keep them aligned with backend validation.

Expense creation and receipt upload are separate backend calls. If upload fails after creation, the form keeps the created ID so retrying updates the same request. A partially completed request can also be reopened from history. No undocumented dashboard endpoints are required: dashboards aggregate all pages of the scoped expense list. For a manager’s personal view, the adapter filters their department-scoped results by requester before applying pagination. This is correct for the current API contract; a future explicit own-scope backend query would improve efficiency on large departments.

Deploy the built static assets with SPA fallback to `index.html` for nested routes. The real backend must enforce all authorization, state transitions, file validation, and approval concurrency independently; frontend guards do not provide server security.

## Finance handoff

Replace `src/pages/finance/FinancePlaceholder.jsx` and extend the Finance route group in `src/App.jsx`. Its Navbar link and permission boundary are already in place. No Employee or Manager page changes are required.

## Verification

`npm test` runs service-level tests covering authentication, scoping, pagination, attachment storage/validation, editable states, required notes, decision transitions, history preservation, and a full cross-account request-changes/resubmission flow. `npm run build` compiles the production bundle.

Tooling references: [Vite](https://vite.dev/guide/), [Tailwind’s Vite integration](https://tailwindcss.com/docs/installation/using-vite), and [React Router](https://reactrouter.com/start/declarative/installation).
