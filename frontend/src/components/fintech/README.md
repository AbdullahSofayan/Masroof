# Fintech workflow motion

The reusable components use the installed `motion/react` package and the existing reduced-motion helper. They render static final states when animation frames or the required browser measurement APIs are unavailable.

- `ReceiptScanPreview`: local image/PDF preview, one 1.2-second scan sweep per selected file, and a capture confirmation. Replacing a file restarts the sweep; object URLs are revoked when replaced or unmounted. Reduced motion confirms immediately. The sweep represents selecting a receipt; it performs no OCR or policy analysis.
- `BudgetProgressBar`: exact spent/allocation ratio, a capped visual track, and emerald below 75%, amber from 75% through 90%, and rose above 90%. Over-allocation percentages remain visible even when the track is full. Missing or invalid budgets show an unavailable state.
- `ApprovalProgressBar`: the existing workflow mapped to Submitted, Manager Review, Finance Review, and Approved, with returned/rejected branches. A manager approval advances to `pending_finance`; final `approved` status remains a Finance decision. Rejection after Finance review is inferred from the existing approval history.
- `AnimatedExpenseRows`: valid table rows, position layout animation, and short opacity transitions. The surrounding fixed column widths and percentage cell widths keep entering and exiting rows aligned. Missing observer APIs and reduced motion use ordinary table rows.
- `SpendSparkline`: six Monday-based weekly totals from final-approved expenses using their expense dates, excluding future dates. The accessible SVG includes exact weekly SAR totals, unique gradient IDs, a draw-on stroke, and a delayed end dot. Missing or throwing SVG geometry APIs use a complete static path.

`StatusBadge` adds whole-label presence transitions, color transitions, and a small scale settle. Manager details remain mounted while applying a server-confirmed decision, so the badge, tracker, and audit history update together. Employee tables retain their current rows while fetching a newly selected status, allowing the next dataset to transition in place.

## Budget data boundary

The documented backend contract contains no department budget. In mock mode, the Manager dashboard explicitly labels its **SAR 12,000 demo department allocation**. This is a presentation-only allocation in `spendData.js`, separate from mock expense schemas and API services. Its numerator is actual final-approved department spend from the dashboard dataset, with the same all-time scope as the summary total. Live mode shows **Budget unavailable** until an authorized budget source is supplied; no new endpoint or finance-management UI is introduced.

## Verification

`fintech.test.jsx` covers threshold boundaries, approval stages and branches, weekly spend aggregation, missing/throwing SVG APIs, reduced-motion final states, receipt replacement and cleanup, real scan completion, valid animated table rows, filter loading, manager decisions without remounting, and receipt drop/submission through the existing service interface. Existing service and UI test files are preserved.
