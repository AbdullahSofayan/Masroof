# Task: make "unseen" suspicious requests to test the AI (≈1–2 hours)

*From: Jassar (ML) · For: one teammate · Mentor feedback MF3*

## Why
The mentors asked us to test the anomaly model on suspicious patterns it was **not designed for**.
I can't make those myself, because I know what the model looks for. So you invent them, and you
**don't tell me what they are** until I've reported the results.

## What you get
- `requests.csv`: the demo history (≈248k requests, ids, employees, departments, categories, SAR amounts, dates).
  Look at it to make your cases realistic (for example, pick an employee and see what they normally request).

## What to make
- **5–8 different patterns** of suspicious behavior, your own ideas. Think: *"what would a dishonest or careless
  employee do that the company would want a manager to look at?"*
- **20–50 cases per pattern.** A case = one employee's suspicious behavior; it can be 1 request or several.
- **≈300 requests in total at most.**
- **Optional:** 20–50 **normal-looking** cases (an employee doing something ordinary for them), to check the AI
  doesn't flag those.

**Please avoid these (already tested, they're "seen"):** an amount much bigger than the person's usual, splitting one
purchase into several requests just under the category limit, the same request twice on one day, a first-ever category
with a big amount, round amounts on Friday/Saturday, 10+ requests in one day.

## Rules for each request
| Column | Example | Rule |
|---|---|---|
| `case_id` | 7 | Your own number; all requests of one case share it |
| `requester_id` | 2259 | An existing employee (1001–5577) from `requests.csv`. **Not** 1194, 1237, 1752, 1759, 2712, 4097, 4438, 4481, 4851, 5060, 5112, 5438, 5571. One case per employee |
| `department_id` | 1 | That employee's department in `requests.csv` |
| `category` | Office Supplies | Exactly one of: Food, Travel, Transportation, Office Supplies, IT & Telecom, Equipment & Maintenance |
| `amount_sar` | 2450.00 | SAR, greater than 0, up to 2 decimals |
| `expense_date` | 2026-05-14 | Between **2026-04-01 and 2026-06-27** (YYYY-MM-DD). Weekend = Friday, Saturday |

## What to send
1. **`unseen_requests.csv`** → to Jassar. Only the 6 columns above, **no pattern names, no hints**.
2. **`unseen_answers.csv`** → **keep it**; send it only after I share the results. Columns: `case_id`, `pattern`
   (a short name), `description` (one sentence: what's suspicious), and `is_normal` (yes for the optional normal cases).

Excel is fine: save as **CSV UTF-8**. Questions about the format → ask me; questions about ideas → don't 🙂

## What happens next
I run your requests through the AI exactly like real ones and report, per case, whether it was flagged and why.
Then you send the answers, and we see which of your patterns the AI catches and which it misses. Both results go in
the presentation: "missed" is useful too, because it shows what the AI can't see.
