# light-forecast

Python service for predictive lighting. Reads the `ambient_light` history from
InfluxDB, forecasts the lux a few seconds ahead with an ARIMA model, and serves
the prediction over HTTP on port 8000.

## Run

```bash
cd light-forecast
python -m venv .venv && . .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # then set INFLUX_TOKEN
uvicorn src.main:app --host 0.0.0.0 --port 8000
```
