import logging

from fastapi import FastAPI

from .forecast import HISTORY_MINUTES, HORIZON_S, forecast_lux
from .influx import fetch_ambient_light

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("main")

app = FastAPI(title="light-forecast")


@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/forecast")
def forecast(horizon_s: int = HORIZON_S):
    try:
        series = fetch_ambient_light(HISTORY_MINUTES)
    except Exception as e:
        # empty fallback so the mashup keeps going
        log.error(f"influx query failed: {e}")
        return {
            "predicted_lux": 0.0,
            "horizon_s": horizon_s,
            "order": [0, 0, 0],
            "n_samples": 0,
            "fallback": True,
        }
    return forecast_lux(series, horizon_s)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)