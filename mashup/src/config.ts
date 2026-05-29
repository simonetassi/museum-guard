import "dotenv/config";

export const CONFIG = {
  sensor: {
    tdUrl: process.env.CONTROLLER_HTTP_PORT ?? 'http://localhost:8080/museumguard-sensor'
  },
} as const;