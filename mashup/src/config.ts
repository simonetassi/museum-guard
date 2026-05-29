import "dotenv/config";

export const CONFIG = {
  sensor: {
    tdUrl: process.env.SENSOR_TD_URL ?? 'http://localhost:8080/museumguard-sensor'
  },
  influxdb: {
    url: process.env.INFLUX_URL ?? "http://localhost:8181",
    token: process.env.INFLUX_TOKEN ?? "token",
    database: process.env.INFLUX_DATABASE ?? "museumguard",
  },
  polling: {
    intervalMs: Number(process.env.POLLING_MS ?? 20000)
  }
} as const;