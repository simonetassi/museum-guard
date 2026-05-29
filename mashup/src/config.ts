import "dotenv/config";

export const CONFIG = {
  sensor: {
    tdUrl: process.env.CONTROLLER_HTTP_PORT ?? 'http://localhost:8080/museumguard-sensor'
  },
  influxdb: {
    url: process.env.INFLUX_URL ?? "http://localhost:8181",
    token: process.env.INFLUX_TOKEN ?? "token",
    database: process.env.INFLUX_DATABASE ?? "museumguard",
  },
} as const;