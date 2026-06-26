import * as coap from "coap";
import type { ObserveReadStream } from "coap";
import pino from "pino";
import { CONFIG } from "../config";
import { AmbientLightReading, AccelerationReading, EventType, SensorEvent } from "../interfaces";

const log = pino({ name: "sensorClient" });

function coapGet(pathname: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = coap.request({
      host: CONFIG.espSen.host,
      port: CONFIG.espSen.coapPort,
      pathname,
      method: "GET",
    });
    req.on("response", (res) => resolve(res.payload));
    req.on("error", reject);
    req.end();
  });
}

function coapPut(pathname: string, body: object): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = coap.request({
      host: CONFIG.espSen.host,
      port: CONFIG.espSen.coapPort,
      pathname,
      method: "PUT",
    });
    req.setOption("Content-Format", "application/json");
    req.on("response", (res) => {
      if (res.code.startsWith("2.")) {
        resolve();
      } else {
        reject(new Error(`CoAP PUT ${pathname} failed: ${res.code}`));
      }
    });
    req.on("error", reject);
    req.end(Buffer.from(JSON.stringify(body)));
  });
}

export async function readAmbientLight(): Promise<AmbientLightReading> {
  const payload = await coapGet(CONFIG.espSen.resources.ambientLight);
  const { lux, timestamp } = JSON.parse(payload.toString()) as { lux: number; timestamp: string };
  return { lux, timestamp };
}

export async function readAcceleration(): Promise<AccelerationReading> {
  const payload = await coapGet(CONFIG.espSen.resources.acceleration);
  const { x, y, z, timestamp } = JSON.parse(payload.toString()) as {
    x: number;
    y: number;
    z: number;
    timestamp: string;
  };
  return { x, y, z, timestamp };
}

function startObserve(
  pathname: string,
  type: EventType,
  callback: (event: SensorEvent) => void
): () => void {
  const req = coap.request({
    host: CONFIG.espSen.host,
    port: CONFIG.espSen.coapPort,
    pathname,
    observe: true,
  });

  let stream: ObserveReadStream | null = null;

  req.on("response", (res) => {
    stream = res as ObserveReadStream;
    stream.on("data", (chunk: Buffer) => {
      try {
        const { value, timestamp } = JSON.parse(chunk.toString()) as { value: number; timestamp: string };
        callback({ type, value, timestamp });
      } catch (err) {
        log.error({ err }, `Failed to parse ${type} event payload`);
      }
    });
    stream.on("error", (err) => {
      log.error({ err }, `Error on ${type} observe stream`);
    });
  });

  req.on("error", (err) => {
    log.error({ err }, `Failed to start ${type} observe request`);
  });

  req.end();

  return () => {
    stream?.close();
  };
}

export function startObserveImpact(
  callback: (event: SensorEvent) => void
): () => void {
  return startObserve(CONFIG.espSen.resources.impactEvent, EventType.Impact, callback);
}

export function startObserveTheft(
  callback: (event: SensorEvent) => void
): () => void {
  return startObserve(CONFIG.espSen.resources.theftEvent, EventType.Theft, callback);
}

export async function readImpactThreshold(): Promise<number> {
  const payload = await coapGet(CONFIG.espSen.resources.impactThreshold);
  return (JSON.parse(payload.toString()) as { value: number }).value;
}

export async function writeImpactThreshold(value: number): Promise<void> {
  await coapPut(CONFIG.espSen.resources.impactThreshold, { value });
  log.info({ value }, "impact threshold updated");
}

export async function readTheftThreshold(): Promise<number> {
  const payload = await coapGet(CONFIG.espSen.resources.theftThreshold);
  return (JSON.parse(payload.toString()) as { value: number }).value;
}

export async function writeTheftThreshold(value: number): Promise<void> {
  try {
    await coapPut(CONFIG.espSen.resources.theftThreshold, { value });
  } catch (err) {
    log.error(err, "theft threshold write failed");
    throw err;
  }
}
