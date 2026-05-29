import { CONFIG } from "../config"
import {InfluxDBClient, Point} from "@influxdata/influxdb3-client"

enum EventType {
  IMPACT = "impact",
  THEFT = "theft",
}

let client: InfluxDBClient;

export function initInflux(): void {
  client = new InfluxDBClient({
    host: CONFIG.influxdb.url,
    token: CONFIG.influxdb.token,
    database: CONFIG.influxdb.database,
  })
}

export async function writeLightMeasurement(lux: number): Promise<void> {
  const point = Point.measurement("ambient_light")
    .setTag("node", "esp-sen")
    .setFloatField("lux", lux);

  await client.write(point);
}

export async function writeAcceleration(x: number, y: number, z: number): Promise<void> {
  const point = Point.measurement("acceleration")
    .setTag("node", "esp-sen")
    .setFloatField("x", x)
    .setFloatField("y", y)
    .setFloatField("z", z);

  await client.write(point);
}

export async function writeEvent(type: EventType, value: number): Promise<void> {
  const measurement = type === EventType.IMPACT ? "impact_event" :  "theft_event";
  const point = Point.measurement(measurement) 
    .setTag("node", "esp-sen")
    .setFloatField("value", value);

  await client.write(point);
}

export function closeInfluxWriter(): void {
  client.close();
}