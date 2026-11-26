"""Request history kept by the ML service (Step 9).

The model compares each new request with the employee's, department's and category's EARLIER
requests (Step 5). The service can't read the database, so it keeps its own copy of the history:
the training requests, plus every request it scores (the backend sends each one).

    History.from_requests(requests)   -> history from the training requests (bulk buyers left out)
    history.request_features(...)     -> the features of ONE new request, exactly like
                                         features.build_features would compute them
    history.add(rows)                 -> save scored requests (same expense_id again = replaced)
    history.contains(row)             -> is this exact request already in the history?
    history.save(path) / History.load(path)
"""

import joblib
import numpy as np
import pandas as pd

from src import features as F

COLUMNS = ["expense_id", "requester_id", "department_id", "category", "expense_date", "amount_sar"]
CATEGORIES = ["Food", "Travel", "Transportation", "Office Supplies", "IT & Telecom", "Equipment & Maintenance"]


class History:
    def __init__(self, rows):
        rows = rows[COLUMNS].copy()
        rows["expense_date"] = pd.to_datetime(rows["expense_date"])
        rows["amount_sar"] = rows["amount_sar"].astype(float).round(2)
        rows["department_id"] = rows["department_id"].astype(float)      # float so a missing department can be NaN
        rows["category_code"] = pd.Categorical(rows["category"], categories=CATEGORIES).codes   # numbers: faster to compare
        rows["log_amount"] = np.log1p(rows["amount_sar"])
        self.rows = (rows.drop_duplicates("expense_id", keep="last")
                         .sort_values(["expense_date", "expense_id"]).reset_index(drop=True))
        self._refresh()

    def _refresh(self):
        """Plain numpy copies of the columns: looking things up in them is ~100x faster than in pandas."""
        r = self.rows
        self.ids = r["expense_id"].to_numpy()
        self.emp = r["requester_id"].to_numpy()
        self.dept = r["department_id"].to_numpy()
        self.cat = r["category_code"].to_numpy()
        self.day = r["expense_date"].to_numpy()
        self.amount = r["amount_sar"].to_numpy()
        self.log = r["log_amount"].to_numpy()

    # ---------- building, saving, loading ----------
    @classmethod
    def from_requests(cls, requests):
        """Training history: every request except the bulk buyers' (same as build_features)."""
        busy = F.find_bulk_buyers(requests)
        return cls(requests[~requests["requester_id"].isin(busy)])

    def save(self, path):
        """Saved as plain numpy columns (not a pandas table), so it loads with any pandas version."""
        rows = self.rows[COLUMNS].sort_values(["expense_date", "expense_id"])
        joblib.dump({c: rows[c].to_numpy() for c in COLUMNS}, path, compress=3)

    @classmethod
    def load(cls, path):
        return cls(pd.DataFrame(joblib.load(path)))

    def contains(self, row):
        """True if this exact request (same id, employee, department, category, date, amount) is already here."""
        i = np.flatnonzero(self.ids == row["expense_id"])
        if len(i) == 0:
            return False
        i = i[0]
        dept = np.nan if row.get("department_id") is None else float(row["department_id"])
        return (self.emp[i] == row["requester_id"]
                and (self.dept[i] == dept or (np.isnan(self.dept[i]) and np.isnan(dept)))
                and self.cat[i] == CATEGORIES.index(row["category"])
                and self.day[i] == pd.Timestamp(row["expense_date"]).to_datetime64()
                and self.amount[i] == round(float(row["amount_sar"]), 2))

    def add(self, rows):
        """Add scored requests. A request scored again (edited) replaces its old version.
        Only the new rows are prepared; the order of the rows doesn't matter for the lookups."""
        new = History(pd.DataFrame(rows)).rows
        kept = self.rows[~self.rows["expense_id"].isin(new["expense_id"])]
        self.rows = pd.concat([kept, new], ignore_index=True)
        self._refresh()

    # ---------- the features of one new request ----------
    def _stats(self, mask):
        """n, mean, std of log_amount for the history rows in mask (same formulas as prior_stats)."""
        values = self.log[mask]
        n = len(values)
        if n == 0:
            return 0, np.nan, np.nan
        mean = values.mean()
        if n == 1:
            return 1, mean, np.nan
        var = (np.square(values).sum() - n * mean ** 2) / (n - 1)
        return n, mean, np.sqrt(max(var, 0.0))

    def request_features(self, expense_id, requester_id, department_id, category, amount_sar,
                         expense_date, same_day=(), typed_amount=None):
        """Features of one request, compared only with history from EARLIER days (MF1).

        same_day: the employee's OTHER requests for the same date, as dicts with expense_id,
                  category, amount_sar (the backend's same_day_requests).
        typed_amount: the amount as written, for the round / made-up-digits checks (SAR in Masroof).
        Returns a one-row DataFrame with the same columns as features.build_features."""
        date = pd.Timestamp(expense_date)
        amount_sar = round(float(amount_sar), 2)
        typed = amount_sar if typed_amount is None else float(typed_amount)
        log_amount = np.log1p(amount_sar)
        dept = np.nan if department_id is None else float(department_id)

        # 1. Statistics of the 5 groups, earlier days only (Step 5, Part A)
        today = date.to_datetime64()
        earlier = self.day < today
        is_emp, is_cat = self.emp == requester_id, self.cat == CATEGORIES.index(category)
        is_dept = self.dept == dept                      # NaN == NaN is False: no department → no history
        masks = {"emp": is_emp, "empcat": is_emp & is_cat, "dept": is_dept,
                 "deptcat": is_dept & is_cat, "cat": is_cat}
        row = {"log_amount": log_amount}
        for name, mask in masks.items():
            row[f"{name}_n"], row[f"{name}_mean"], row[f"{name}_std"] = self._stats(earlier & mask)
        one = pd.DataFrame([row])

        # 2. Amount z-scores with the cold-start cascade (Step 5, Part B)
        for feature, levels in F.AMOUNT_FEATURES.items():
            z, used = F.cascade(one, levels)
            row[feature] = float(z.iloc[0])
            if feature == "amount_vs_employee_category":
                row["baseline_level"] = used.iloc[0]

        # 3. Category share: own history if 5+ requests, else the department's, else 1.0
        if row["emp_n"] >= F.MIN_HISTORY:
            share = row["empcat_n"] / row["emp_n"]
        elif row["dept_n"] >= F.MIN_HISTORY:
            share = row["deptcat_n"] / row["dept_n"]
        else:
            share = 1.0

        # 4. Same-day counts: this request + the same-day requests the backend sent (Step 5, Part C)
        day = [{"expense_id": expense_id, "category": category, "amount_sar": amount_sar}]
        day += [{"expense_id": d["expense_id"], "category": d["category"],
                 "amount_sar": round(float(d["amount_sar"]), 2)} for d in same_day]
        day = pd.DataFrame(day).drop_duplicates("expense_id")
        same_cat = day["category"] == category
        daily = len(day)
        same_category = int(same_cat.sum())
        duplicates = int((same_cat & (day["amount_sar"] == amount_sar)).sum())

        # 5. Time rules (Step 8, Part D): the previous request with the same category + amount
        #    (earlier day, or the same day with a smaller id), and the previous day with any request
        same_amount = is_emp & is_cat & (self.amount == amount_sar)
        before = earlier | ((self.day == today) & (self.ids < expense_id))
        previous = self.day[same_amount & before]
        twins_today = day[same_cat & (day["amount_sar"] == amount_sar) & (day["expense_id"] < expense_id)]
        if len(twins_today):
            days_same = 0.0
        elif len(previous):
            days_same = float((date - pd.Timestamp(previous.max())).days)
        else:
            days_same = np.nan
        earlier_days = self.day[is_emp & earlier]
        days_last = float((date - pd.Timestamp(earlier_days.max())).days) if len(earlier_days) else np.nan

        out = {
            "expense_id": expense_id, "requester_id": requester_id, "department_id": dept,
            "category": category, "expense_date": date, "amount_sar": amount_sar,
            "baseline_level": row["baseline_level"],
            "log_amount": log_amount,
            "amount_vs_employee": row["amount_vs_employee"],
            "amount_vs_employee_category": row["amount_vs_employee_category"],
            "amount_vs_department": row["amount_vs_department"],
            "category_share_for_employee": float(share),
            "same_category_day_count": same_category,
            "duplicate_count": duplicates,
            "daily_request_count": daily,
            "other_category_day_count": daily - same_category,
            "is_weekend": int(date.day_of_week in F.WEEKEND_DAYS),
            "is_round_amount": int(typed % 100 == 0 and typed >= 100),
            "days_since_same_amount": days_same,
            "days_since_last_request": days_last,
            "amount_digits_pattern": int(F.digits_pattern(typed) and typed >= F.DIGITS_MIN_AMOUNT),
        }
        return pd.DataFrame([out])[F.ID_COLUMNS + F.FEATURES + F.RULE_COLUMNS]
