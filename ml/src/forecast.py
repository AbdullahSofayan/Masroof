"""Predict Masroof department spending for the next four weeks.

The Linear Regression model is trained and exported by
ml/notebooks/forecasting.ipynb. This file only runs predictions.
"""

from pathlib import Path

import joblib
import pandas as pd


def predict_next_four_weeks(department_id, last_four_weeks):
    """Return four weekly expense predictions (SAR) for one department.

    last_four_weeks must contain exactly four COMPLETED consecutive weeks,
    ordered from oldest to newest. These totals must use the same approved,
    localized expense history and Sunday-Saturday weeks as the notebook.

    Example: [10000, 12000, 11000, 15000]
    """
    if len(last_four_weeks) != 4:
        raise ValueError("Provide exactly four completed weeks of expenses.")

    if any(pd.isna(value) for value in last_four_weeks):
        raise ValueError("A weekly total is missing. Do not silently replace it with zero.")

    model_path = Path(__file__).resolve().parent.parent / "models" / "forecasting.joblib"
    saved = joblib.load(model_path)

    department_id = int(department_id)
    department_ids = saved["department_ids"]

    if department_id not in department_ids:
        raise ValueError("Department ID was not included in model training.")

    # Use the same input feature names and order as in the training notebook.
    inputs = pd.DataFrame({
        "lag_1": [float(last_four_weeks[3])],  # Most recent completed week
        "lag_2": [float(last_four_weeks[2])],
        "lag_3": [float(last_four_weeks[1])],
        "lag_4": [float(last_four_weeks[0])],  # Oldest of the four weeks
        "department_id": [department_id],
    })

    inputs["department_id"] = pd.Categorical(
        inputs["department_id"], categories=department_ids
    )

    inputs = pd.get_dummies(
        inputs,
        columns=["department_id"],
        drop_first=True,
        dtype=float,
    )

    # Match every column and its order from training.
    inputs = inputs.reindex(columns=saved["feature_columns"], fill_value=0)

    predictions = saved["model"].predict(inputs)[0]

    # Real spending cannot be negative; clip impossible negative predictions.
    return [round(max(0, float(amount)), 2) for amount in predictions]

# test
if __name__ == "__main__":
    print(
        predict_next_four_weeks(
            1,
            [1481641.84, 1169765.42, 1267278.02, 1464812.92]
        )
    )