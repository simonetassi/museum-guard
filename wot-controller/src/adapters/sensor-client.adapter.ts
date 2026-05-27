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

export async function readAmbientLight(): Promise<AmbientLightReading> {
  try {
    const payload = await coapGet(CONFIG.espSen.resources.ambientLight);
    const { lux } = JSON.parse(payload.toString()) as { lux: number };
    return { lux, timestamp: new Date().toISOString() };
  } catch (err) {
    log.error({ err }, "Failed to read ambient light");
    throw err;
  }
}

export async function readAcceleration(): Promise<AccelerationReading> {
  try {
    const payload = await coapGet(CONFIG.espSen.resources.acceleration);
    const { x, y, z } = JSON.parse(payload.toString()) as {
      x: number;
      y: number;
      z: number;
    };
    return { x, y, z, timestamp: new Date().toISOString() };
  } catch (err) {
    log.error({ err }, "Failed to read acceleration");
    throw err;
  }
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
        const { value } = JSON.parse(chunk.toString()) as { value: number };
        callback({ type, value, timestamp: new Date().toISOString() });
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
