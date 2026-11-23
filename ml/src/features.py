"""Feature engineering shared by the notebooks and (from Step 9) the ML service.

One copy of the feature code, so training, evaluation and serving compute features
exactly the same way. Built from notebook 04 (Step 5), 05 (Step 6) and 06 (Step 7).

    build_features(requests)  -> every candidate feature for a table of requests (notebook 04)
    model_input(data, cfg)    -> the 5 model features, one-sided (notebook 06, 7.8)
    apply_rules(data, cfg)    -> the 3 same-day rules (notebook 06, 7.13)

`cfg` is models/model_config.json, loaded with json.load.
"""

import numpy as np
import pandas as pd

# ---------- Settings (Step 5, cell 5.6; Step 6, cell 5.1b) ----------
MIN_HISTORY = 5          # trust an average only with >= 5 earlier requests (cold-start rule)
MIN_STD = 0.1            # minimum spread, so "always the same amount" doesn't divide by 0
Z_CAP = 10               # anything beyond ±10 spreads is just "extremely unusual"
BUSY_FROM = 5            # usual day >= 5 requests = bulk buyer, left out
WEEKEND_DAYS = (4, 5)    # Friday, Saturday (Monday = 0)
DIGITS_MIN_AMOUNT = 100  # made-up-looking digits only count from 100 (as typed); 99.99 is a normal price

# The 5 kinds of history every request is compared with (Step 5, cell 5.3)
GROUPS = {
    "emp": ["requester_id"],
    "empcat": ["requester_id", "category"],
    "dept": ["department_id"],
    "deptcat": ["department_id", "category"],
    "cat": ["category"],
}

# Fallback order for each amount feature (Step 5, cell 5.8)
AMOUNT_FEATURES = {
    "amount_vs_employee_category": ["empcat", "emp", "deptcat", "cat"],
    "amount_vs_employee": ["emp", "dept", "cat"],
    "amount_vs_department": ["dept", "cat"],
}

# Every candidate feature saved in features.csv (Step 5, cell 5.13)
FEATURES = [
    "log_amount",
    "amount_vs_employee", "amount_vs_employee_category", "amount_vs_department",
    "category_share_for_employee",
    "same_category_day_count", "duplicate_count", "daily_request_count",
    "other_category_day_count",
    "is_weekend", "is_round_amount",
]
# Extra columns used only by the rules added in Step 8 (Part D, round 1 of the unseen test)
RULE_COLUMNS = ["days_since_same_amount", "days_since_last_request", "amount_digits_pattern"]
ID_COLUMNS = ["expense_id", "requester_id", "department_id", "category", "expense_date",
              "amount_sar", "baseline_level"]


# ---------- Step 6: bulk buyers ----------
def find_bulk_buyers(df):
    """Employees whose usual day (median requests per active day) is BUSY_FROM or more."""
    per_day = df.groupby(["requester_id", "expense_date"]).size()
    usual_day = per_day.groupby("requester_id").median()
    return sorted(usual_day[usual_day >= BUSY_FROM].index)


def digits_pattern(amount):
    """1 if the amount looks made up: its digits (without the decimal point, leading and trailing zeros)
    are 4+ of the same digit (1,111.11) or a run like 1234 / 4321 (1,234.56). Step 8, Part D."""
    digits = f"{amount:.2f}".replace(".", "").lstrip("0").rstrip("0")
    if len(digits) < 4:
        return 0
    repeated = len(set(digits)) == 1
    sequential = digits in "1234567890" or digits in "9876543210"
    return int(repeated or sequential)


# ---------- Step 5, Part A: statistics from earlier days only ----------
def prior_stats(df, keys, name):
    """Add <name>_n, <name>_mean, <name>_std: count, average and spread of log_amount
    for the same group, using only EARLIER days (cumulative sums minus the day itself)."""
    day = (df.groupby(keys + ["expense_date"], as_index=False)
             .agg(n=("log_amount", "size"), s=("log_amount", "sum"), s2=("log_amount_sq", "sum")))
    day = day.sort_values(keys + ["expense_date"])
    g = day.groupby(keys)
    n_prev = g["n"].cumsum() - day["n"]
    s_prev = g["s"].cumsum() - day["s"]
    s2_prev = g["s2"].cumsum() - day["s2"]
    mean = s_prev / n_prev.where(n_prev > 0)
    var = (s2_prev - n_prev * mean ** 2) / (n_prev - 1).where(n_prev > 1)
    day[f"{name}_n"] = n_prev
    day[f"{name}_mean"] = mean
    day[f"{name}_std"] = np.sqrt(var.clip(lower=0))
    cols = keys + ["expense_date", f"{name}_n", f"{name}_mean", f"{name}_std"]
    return df.merge(day[cols], on=keys + ["expense_date"], how="left")


# ---------- Step 5, Part B: amount z-scores + the cold-start rule ----------
def zscore(df, level):
    std = df[f"{level}_std"].clip(lower=MIN_STD)
    z = (df["log_amount"] - df[f"{level}_mean"]) / std
    return z.clip(-Z_CAP, Z_CAP)


def cascade(df, levels):
    """Use the first level with >= MIN_HISTORY earlier requests; none → 0 (normal)."""
    conditions = [df[f"{lv}_n"] >= MIN_HISTORY for lv in levels]
    values = [zscore(df, lv) for lv in levels]
    z = np.select(conditions, values, default=np.nan)
    used = np.select(conditions, levels, default="none")
    return pd.Series(z, index=df.index).fillna(0.0), pd.Series(used, index=df.index)


# ---------- The whole pipeline (notebook 04) ----------
def build_features(requests, remove_bulk_buyers=True, round_column="amount_usd"):
    """requests: one row per request with expense_id, requester_id, department_id, category,
    amount_sar, amount_usd, expense_date (datetime). Returns ID_COLUMNS + FEATURES,
    sorted by date, exactly like features.csv.

    round_column: the amount as it was originally written (USD for PCard history; SAR for
    requests typed in Masroof)."""
    df = requests.sort_values(["expense_date", "expense_id"]).reset_index(drop=True)
    df["log_amount"] = np.log1p(df["amount_sar"])
    df["log_amount_sq"] = df["log_amount"] ** 2

    if remove_bulk_buyers:
        busy = find_bulk_buyers(df)
        df = df[~df["requester_id"].isin(busy)].reset_index(drop=True)

    for name, keys in GROUPS.items():
        df = prior_stats(df, keys, name)

    for feature, levels in AMOUNT_FEATURES.items():
        df[feature], used = cascade(df, levels)
        if feature == "amount_vs_employee_category":
            df["baseline_level"] = used

    emp_share = df["empcat_n"] / df["emp_n"]
    dept_share = df["deptcat_n"] / df["dept_n"]
    df["category_share_for_employee"] = np.select(
        [df["emp_n"] >= MIN_HISTORY, df["dept_n"] >= MIN_HISTORY],
        [emp_share, dept_share], default=1.0)

    day = ["requester_id", "expense_date"]
    df["daily_request_count"] = df.groupby(day)["expense_id"].transform("size")
    df["same_category_day_count"] = df.groupby(day + ["category"])["expense_id"].transform("size")
    df["duplicate_count"] = df.groupby(day + ["category", "amount_sar"])["expense_id"].transform("size")
    df["other_category_day_count"] = df["daily_request_count"] - df["same_category_day_count"]

    df["is_weekend"] = df["expense_date"].dt.day_of_week.isin(WEEKEND_DAYS).astype(int)
    df["is_round_amount"] = ((df[round_column] % 100 == 0) & (df[round_column] >= 100)).astype(int)

    # Step 8, Part D: columns for the 3 time / digit rules (earlier requests only)
    same = df.groupby(["requester_id", "category", "amount_sar"])["expense_date"]
    df["days_since_same_amount"] = (df["expense_date"] - same.shift(1)).dt.days
    active = df[["requester_id", "expense_date"]].drop_duplicates().sort_values(["requester_id", "expense_date"])
    active["days_since_last_request"] = active.groupby("requester_id")["expense_date"].diff().dt.days
    df = df.merge(active, on=["requester_id", "expense_date"], how="left")
    df["amount_digits_pattern"] = (df[round_column].apply(digits_pattern)
                                   * (df[round_column] >= DIGITS_MIN_AMOUNT)).astype(int)

    return df[ID_COLUMNS + FEATURES + RULE_COLUMNS]


# ---------- Step 7: what the model sees ----------
def model_input(data, cfg):
    """The 5 model features, one-sided: only HIGHER than normal counts (Step 7, 7.8)."""
    X = data[cfg["model_features"]].copy()
    X["log_amount"] = X["log_amount"].clip(lower=cfg["model_input"]["log_amount_floor"])
    X["amount_vs_employee_category"] = X["amount_vs_employee_category"].clip(
        lower=cfg["model_input"]["amount_vs_employee_category_floor"])
    return X


# ---------- Step 7: the 3 rules ----------
def apply_rules(data, cfg):
    """True/False per request for each same-day rule; column names = reason codes (Step 7, 7.13)."""
    r, limits = cfg["rules"], cfg["category_limits"]
    same_day = data.groupby(["requester_id", "expense_date", "category"])["amount_sar"]
    total = same_day.transform("sum")
    smallest = same_day.transform("min")
    largest = same_day.transform("max")
    limit = data["category"].map(limits)
    n = data["same_category_day_count"]
    split = ((n >= 2) & (n <= r["split_max_parts"]) & (largest <= limit) & (total > limit)
             & (smallest >= r["split_min_part"] * limit))
    duplicate = (data["duplicate_count"].between(2, r["duplicate_max_copies"])
                 & (data["amount_sar"] >= r["duplicate_min_amount"]))
    many = data["other_category_day_count"] >= r["many_other_from"]
    rules = {"possible_split_request": split,
             "duplicate_request": duplicate,
             "many_requests_same_day": many}
    if "recent_duplicate_days" in r:      # the 3 rules added in Step 8 (Part D)
        rules["duplicate_recent_request"] = (
            data["days_since_same_amount"].between(1, r["recent_duplicate_days"])
            & (data["amount_sar"] >= r["duplicate_min_amount"]))
        rules["unusual_amount_digits"] = data["amount_digits_pattern"] == 1
        rules["returning_after_long_break"] = data["days_since_last_request"] >= r["long_break_days"]
    return pd.DataFrame(rules, index=data.index)


def risk_levels(scores, rules, cfg):
    """high = model's top 1%; medium = model's next 1% or any rule; low = the rest (Step 7, 7.15)."""
    c = cfg["cut_offs"]
    return np.where(scores >= c["high_from"], "high",
           np.where((scores >= c["medium_from"]) | rules.any(axis=1), "medium", "low"))