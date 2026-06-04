import { EventType } from "../common/types";
import { CONFIG } from "../config"
import {InfluxDBClient, Point} from "@influxdata/influxdb3-client"

let client: InfluxDBClient;

export function initInflux(): void {
  client = new InfluxDBClient({
    host: CONFIG.influxdb.url,
    token: CONFIG.influxdb.token,
    database: CONFIG.influxdb.database,
  })
}

export async function writeLightMeasurement(lux: number, timestamp: Date): Promise<void> {
  const point = Point.measurement("ambient_light")
    .setTag("node", "esp-sen")
    .setFloatField("lux", lux)
    .setTimestamp(timestamp);

  await client.write(point);
}

export async function writeAcceleration(x: number, y: number, z: number, timestamp: Date): Promise<void> {
  const point = Point.measurement("acceleration")
    .setTag("node", "esp-sen")
    .setFloatField("x", x)
    .setFloatField("y", y)
    .setFloatField("z", z)
    .setTimestamp(timestamp);

  await client.write(point);
}

export async function writeEvent(type: EventType, value: number, timestamp: Date): Promise<void> {
  const measurement = type === EventType.IMPACT ? "impact_event" : "theft_event";
  const point = Point.measurement(measurement)
    .setTag("node", "esp-sen")
    .setFloatField("value", value)
    .setTimestamp(timestamp);

  await client.write(point);
}

export async function writeLightingIntensity(intensity: number, timestamp: Date): Promise<void> {
  const point = Point.measurement("lighting_intensity")
    .setTag("node", "esp-act")
    .setIntegerField("intensity", intensity)
    .setTimestamp(timestamp);
  await client.write(point);
}

export async function writeFixedLedState(fixedLedState: string, timestamp: Date): Promise<void> {
  const point = Point.measurement("fixed_led_state")
    .setTag("node", "esp-act")
    .setStringField("state", fixedLedState)
    .setTimestamp(timestamp);
  await client.write(point);
}

export function closeInfluxWriter(): void {
  client.close();
}