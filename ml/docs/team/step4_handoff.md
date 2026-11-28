# Masroof — Step 4 Handoff (demo data)

*From: Jassar (ML) · 17 Nov 2026*

The ML side turned the Oklahoma PCard data into **Masroof expense requests**: one Saudi company,
20 departments, 6 categories, amounts in SAR, Saudi work week (Sun–Thu, weekend Fri–Sat), dates
from **29 Jun 2025 to 28 Jun 2026**.

| | Count |
|---|---|
| Expense requests (history) | **247,838** |
| Employees | **4,577** |
| Departments | **20** (each with a manager) |
| Finance admins | **2** |
| Categories | **6** |

Sections: **[Backend](#backend)** · **[Frontend](#frontend)** · **[Forecasting](#forecasting)** · **[Questions for the team](#questions-for-the-team)**

---

## Backend

### Please review now — don't import yet
The seed files will come **in your exact column names after your ERD changes are applied**
(`role`, `risk_level`, `risk_justification` JSON…). Importing now would mean redoing it.

### The 20 departments

| `id` | Name | Manager `user_id` | Manager | Employees | Requests (history) |
|---|---|---|---|---|---|
| 1 | Operations | 101 | Razan Al-Faifi | 1,918 | 68,826 |
| 2 | Business Development | 102 | Khalid Al-Balawi | 823 | 52,673 |
| 3 | Research & Development | 103 | Rawan Al-Ghamdi | 406 | 33,903 |
| 4 | Facilities Management | 104 | Badr Al-Saadi | 170 | 14,444 |
| 5 | Fleet & Logistics | 105 | Sara Al-Mutairi | 207 | 10,401 |
| 6 | Projects | 106 | Khalid Al-Qarni | 131 | 8,951 |
| 7 | Engineering | 107 | Amal Al-Muqrin | 44 | 7,256 |
| 8 | Field Services | 108 | Maha Al-Shammari | 93 | 6,278 |
| 9 | Hospitality & Events | 109 | Maha Al-Shahrani | 87 | 5,544 |
| 10 | Security | 110 | Hind Al-Yami | 83 | 4,448 |
| 11 | Administration | 111 | Wafa Al-Ruwaili | 58 | 4,436 |
| 12 | Maintenance | 112 | Shahad Al-Ahmadi | 43 | 4,320 |
| 13 | Health & Safety | 113 | Nouf Al-Otaibi | 39 | 4,123 |
| 14 | Human Resources | 114 | Afnan Al-Anazi | 50 | 3,994 |
| 15 | Environment & Sustainability | 115 | Maha Al-Hazmi | 179 | 3,487 |
| 16 | Training & Development | 116 | Maha Al-Anazi | 55 | 3,404 |
| 17 | Sales | 117 | Yazeed Al-Shehri | 11 | 3,115 |
| 18 | Information Technology | 118 | Asma Al-Thubaiti | 107 | 3,069 |
| 19 | Marketing | 119 | Fahad Al-Shahrani | 48 | 3,054 |
| 20 | Public Relations | 120 | Meshal Al-Rashidi | 25 | 2,112 |

Names are suggestions based on each department's real spending (e.g. Fleet & Logistics spends
mostly on equipment and vehicles). **Want different names? Tell ML** — it's one line to change.

Finance admins: **201 Nawaf Al-Balawi**, **202 Bandar Al-Omari** (no department).

### ID ranges — please don't use these in your own test data

| Range | Who / what |
|---|---|
| 1–20 | Departments |
| 101–120 | Department managers (no expenses — managers don't submit) |
| 201–202 | Finance admins |
| 1001–5577 | Employees |
| 100001–347838 | Expenses (history) |

**These ids must be kept when importing.** The model remembers employees and departments by id.

### Users
- Names are Arabic names in English letters. Names can repeat; ids and usernames never do.
- Username = `firstname.familyname.id` (e.g. `razan.alfaifi.101`), email = username + `@example.com`
  (a domain reserved for examples — can't reach a real person).
- One demo password for all seeded users is fine (hash it once, reuse the hash).

### Categories (exact names)
```
Food, Travel, Transportation, Office Supplies, IT & Telecom, Equipment & Maintenance
```

### EXPENSE_LIMITS — max amount per single request

| Category | `max_amount` (SAR) | Normal requests over it |
|---|---|---|
| Office Supplies | 3,000 | 4.8% |
| IT & Telecom | 7,500 | 4.7% |
| Equipment & Maintenance | 7,500 | 5.1% |
| Food | 2,000 | 4.1% |
| Transportation | 5,000 | 5.3% |
| Travel | 10,000 | 0.8% |

Set near the 95th percentile of real amounts, so only ~5% of requests go over — rare enough that a
warning means something. **Limits apply to one request at a time**, not daily or monthly totals.
Optional extra rule you could add as a warning: *the total of one employee's same-category requests
on the same day is over the limit* (catches split requests).

### History status
All history is `Approved` (it already happened). Only new requests in the demo will be `Pending`.

---

## Frontend

### `sample_requests.csv` — 50 realistic requests for designing screens

| Column | Example |
|---|---|
| `expense_id` | 346990 |
| `requester_id`, `requester_name` | 2259, Yazeed Al-Muqrin |
| `department_id`, `department` | 1, Operations |
| `category` | IT & Telecom |
| `amount_sar` | 251.25 |
| `expense_date` | 2026-06-25 |
| `description` | Computer accessories |
| `status` | Pending / Approved / Rejected |
| `created_at` | 2026-06-25 16:02:00 |

- 8–9 requests per category, 12 departments, the most recent ~2 months.
- **Statuses are mixed on purpose (15 Pending, 30 Approved, 5 Rejected) for screen design only** —
  in the real history everything is Approved.
- **Descriptions are generated** (one of 5 per category), so a description may not fit the amount
  (e.g. a large Transportation request labelled "Parking and tolls"). Fine for layout, not for meaning.
- AI badge / reasons mock data: see `ml/docs/ml_contract.md`, Part D6.

### For dropdowns and filters
- The **20 department names** and the **6 categories** above.
- The **limits table** above, if the request form shows "over the limit" warnings.

---

## Forecasting

### `forecast_data.csv` — the same data the anomaly model uses

| Column | Meaning |
|---|---|
| `expense_date` | Date of the request (`YYYY-MM-DD`) |
| `department_id` | 1–20 (names in the Backend section) |
| `category` | One of the 6 |
| `amount_sar` | Amount in SAR |

247,838 rows. ~8.8 MB, so it's shared directly (it's not in git).

**Using the same data matters:** the dashboard will show forecasts and anomaly flags side by side,
so the totals must match.

### Read this before modelling

1. **Use data from 2025-06-29 onward.** That's the real start of the year (1 July 2013 in the
   original). Before it there are only a handful of early rows.
2. **First and last periods are partial:** June 2025 has only 2 days (29–30 Jun); the last week ends
   on Sun 28 Jun 2026. Drop or flag partial weeks/months.
3. **Only one year of data** → no way to learn yearly seasonality (a second December, a second Ramadan).
   Keep the horizon short (e.g. next week / next month).
4. **Dates are shifted.** Original Jul 2013 – Jun 2014 → shown as Jun 2025 – Jun 2026. Day of week is
   correct for Saudi (Sun–Thu work week, Fri–Sat weekend).
5. **Seasons are American.** November and December dip (US holidays); there is **no Ramadan / Eid
   pattern**. Say this in the presentation if forecasts look odd around those months.
6. **Scope:** only the 6 categories and the 20 departments; refunds removed; amounts = USD × 3.75.

Monthly totals, for a sanity check:

| Month | Requests | Total (M SAR) |
|---|---|---|
| Jul 2025 | 20,726 | 28.2 |
| Aug 2025 | 20,864 | 31.1 |
| Sep 2025 | 22,779 | 34.0 |
| Oct 2025 | 21,493 | 36.8 |
| Nov 2025 | 17,824 | 25.2 |
| Dec 2025 | 14,991 | 24.6 |
| Jan 2026 | 22,053 | 31.0 |
| Feb 2026 | 20,532 | 32.5 |
| Mar 2026 | 22,736 | 37.5 |
| Apr 2026 | 22,658 | 34.6 |
| May 2026 | 19,571 | 28.1 |
| Jun 2026 | 18,474 | 30.1 |

Weekly total: about **7.1 M SAR** on average.

### Mentor feedback for forecasting (MF2)
The mentors asked to:
- **specify the model and the horizon** (what you predict, and how far ahead),
- **compare with a "last week" baseline** (next week = this week),
- use **rolling validation** (train on weeks 1…n, test on week n+1, move forward, repeat),
- set a **numeric MAE target in SAR**.

Please also agree with the backend on **where forecasts come from** (the same AI service under
`/forecast/...`, or a separate one) and their output format.

---

## Questions for the team

| # | Question | Who |
|---|---|---|
| 1 | Are the 20 department names OK? | Everyone |
| 2 | How much history goes into the demo database? Recommendation: a few departments + the last ~6 months (the model keeps its own statistics, so it doesn't need all 247K rows in MySQL) | Backend |
| 3 | Do the limits look right? Block or warn when a request is over? | Backend + team |
| 4 | Add the "same-day total over the limit" warning? | Backend |
| 5 | How many flagged requests can a manager realistically review per week? (sets how many the model flags — mentor feedback MF4) | Team |
| 6 | Forecasting: same service or separate URL? Output format? | Forecasting + backend |
