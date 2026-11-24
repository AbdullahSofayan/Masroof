"""Connects the finance API to the forecasting model (ml/src/forecast.py).

The model code lives in the ML folder and belongs to the AI team.
We load it from its file, so the API keeps working even when the model
or its libraries (pandas, scikit-learn, joblib) are not installed yet.
"""
import importlib.util
from pathlib import Path

MODEL_NAME = "linear_regression"
FORECAST_FILE = Path(__file__).resolve().parents[3] / "ml" / "src" / "forecast.py"

_predict = None


class ForecastUnavailable(Exception):
    """The model code or its libraries are missing on this machine."""


def get_predictor():
    """Return predict_next_four_weeks from the ML code, loading it the first time."""
    global _predict
    if _predict is not None:
        return _predict
    if not FORECAST_FILE.exists():
        raise ForecastUnavailable("The forecasting model is not installed on the server.")
    try:
        spec = importlib.util.spec_from_file_location("masroof_forecast", FORECAST_FILE)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    except ImportError as error:
        raise ForecastUnavailable(f"The forecasting libraries are missing: {error.name}") from error
    _predict = module.predict_next_four_weeks
    return _predict