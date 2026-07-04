import logging
import math
import warnings

import numpy as np
import pandas as pd
from statsmodels.tsa.arima.model import ARIMA
from statsmodels.tsa.stattools import adfuller

warnings.filterwarnings("ignore")
log = logging.getLogger("forecast")

HISTORY_MINUTES = 15
RESAMPLE_S = 20 # same as the mashup poll interval
HORIZON_S = 60
MAX_D = 2
ARIMA_P = 1
ARIMA_Q = 1
MIN_SAMPLES = 10

def _resample(series: pd.Series):
    grid = series.resample(f"{RESAMPLE_S}s").mean()
    return grid.ffill().dropna()


def _determine_d(series: pd.Series):
    d = 0
    current = series
    while d <= MAX_D:
        if current.nunique() <= 1:
            break
        try:
            pvalue = adfuller(current, autolag="AIC")[1]
        except Exception as e:
            log.warning(f"adf failed at d={d}: {e}")
            break
        if pvalue < 0.05 or d == MAX_D:
            break
        current = current.diff().dropna()
        d += 1
    return d


def forecast_lux(series: pd.Series, horizon_s: int = HORIZON_S):
    last_lux = float(series.iloc[-1]) if len(series) else 0.0

    def fallback(n=0):
        log.info(f"no forecast, returning last lux={last_lux:.2f}")
        return {
            "predicted_lux": max(last_lux, 0.0),
            "horizon_s": horizon_s,
            "order": [0, 0, 0],
            "n_samples": n,
            "fallback": True,
        }

    if series.empty:
        return fallback()

    grid = _resample(series)
    n = len(grid)

    if n < MIN_SAMPLES or grid.nunique() <= 1:
        return fallback(n)

    d = _determine_d(grid)
    steps = max(1, math.ceil(horizon_s / RESAMPLE_S))

    try:
        model = ARIMA(grid.to_numpy(), order=(ARIMA_P, d, ARIMA_Q)).fit()
        predicted = float(np.asarray(model.forecast(steps=steps))[-1])
    except Exception as e:
        log.warning(f"arima failed (order={(ARIMA_P, d, ARIMA_Q)}): {e}")
        return fallback(n)

    if not math.isfinite(predicted):
        return fallback(n)

    return {
        "predicted_lux": max(round(predicted, 2), 0.0),
        "horizon_s": horizon_s,
        "order": [ARIMA_P, d, ARIMA_Q],
        "n_samples": n,
        "fallback": False,
    }
