import logging
import os

import pandas as pd
from dotenv import load_dotenv
from influxdb_client_3 import InfluxDBClient3

load_dotenv()

INFLUX_URL = os.getenv("INFLUX_URL", "http://localhost:8181")
INFLUX_TOKEN = os.getenv("INFLUX_TOKEN", "")
INFLUX_DATABASE = os.getenv("INFLUX_DATABASE", "museumguard")

log = logging.getLogger("influx")


def fetch_ambient_light(history_minutes: int):
    sql = (
        "SELECT time, lux FROM ambient_light "
        "WHERE node = 'esp-sen' "
        f"AND time > now() - interval '{int(history_minutes)} minutes' "
        "ORDER BY time"
    )

    client = InfluxDBClient3(host=INFLUX_URL, token=INFLUX_TOKEN, database=INFLUX_DATABASE)
    try:
        table = client.query(query=sql, language="sql")
    finally:
        client.close()

    df = table.to_pandas()
    if df.empty:
        return pd.Series(dtype="float64")

    df["time"] = pd.to_datetime(df["time"], utc=True)
    return df.set_index("time")["lux"].astype(float).sort_index()
