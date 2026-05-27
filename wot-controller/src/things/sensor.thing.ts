import * as WoT from "wot-typescript-definitions";
import pino from "pino";
import { CONFIG } from "../config";
import {
  readAmbientLight,
  readAcceleration,
  startObserveImpact,
  startObserveTheft,
} from "../adapters/sensor-client.adapter";
import { SENSOR_TD } from "../td/sensor.td";

const log = pino({ name: "sensorThing" });

let pollingInterval: NodeJS.Timeout | null = null;
let cancelObserveImpact: (() => void) | null = null;
let cancelObserveTheft: (() => void) | null = null;

export async function produceSensorThing(wot: typeof WoT): Promise<WoT.ExposedThing> {
  const thing = await wot.produce(SENSOR_TD as WoT.ExposedThingInit);

  const state = {
    ambientLight: 0,
    accelerationX: 0,
    accelerationY: 0,
    accelerationZ: 0,
  };

  pollingInterval = setInterval(async () => {
    try {
      const light = await readAmbientLight();
      state.ambientLight = light.lux;
    } catch (err) {
      log.error({ err }, "Failed to poll ambient light");
    }

    try {
      const accel = await readAcceleration();
      state.accelerationX = accel.x;
      state.accelerationY = accel.y;
      state.accelerationZ = accel.z;
    } catch (err) {
      log.error({ err }, "Failed to poll acceleration");
    }
  }, CONFIG.espSen.pollingIntervalMs);

  thing.setPropertyReadHandler("ambientLight", async () => state.ambientLight);
  thing.setPropertyReadHandler("accelerationX", async () => state.accelerationX);
  thing.setPropertyReadHandler("accelerationY", async () => state.accelerationY);
  thing.setPropertyReadHandler("accelerationZ", async () => state.accelerationZ);

  cancelObserveImpact = startObserveImpact((event) => {
    log.warn({ value: event.value, timestamp: event.timestamp }, "Impact detected");
    thing.emitEvent("impactDetected", { value: event.value, timestamp: event.timestamp });
  });

  cancelObserveTheft = startObserveTheft((event) => {
    log.warn({ value: event.value, timestamp: event.timestamp }, "Theft detected");
    thing.emitEvent("theftDetected", { value: event.value, timestamp: event.timestamp });
  });

  await thing.expose();
  return thing;
}

export function stopSensorThing(): void {
  if (pollingInterval !== null) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  cancelObserveImpact?.();
  cancelObserveImpact = null;
  cancelObserveTheft?.();
  cancelObserveTheft = null;
}
