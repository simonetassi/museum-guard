import { CONFIG } from "../config";
import { writeAcceleration, writeLightMeasurement } from "../storage/influxWriter";
import { getActuator, getSensor } from "../wot/consumer";
import pino from "pino";

const log = pino({ name: "sensorPoller" });

let pollingInterval: ReturnType<typeof setInterval>;

const TARGET_LUX = 300;          
const MAX_INTENSITY = 100;
const MIN_INTENSITY = 0;

export function startSensorPoller(): void {
  pollingInterval = setInterval(async () => {
    let lux: number | null = null;

    try {
      const lightRaw = await getSensor().readProperty("ambientLight");
      lux = await lightRaw.value() as number;
      await writeLightMeasurement(lux);
      log.info({ lux }, "ambient light written");
    } catch (err) {
      log.error(err, "failed to read/write ambient light");
    }
    
    if (lux !== null) {
      try {
        const fixedLedStateRaw = await getActuator().readProperty("fixedLedState");
        const fixedLedState = await fixedLedStateRaw.value();

        if (fixedLedState === "off"){
          const deficit = TARGET_LUX - lux;
          const intensity = Math.round(Math.max(MIN_INTENSITY, Math.min(MAX_INTENSITY, (deficit / TARGET_LUX) * 100)));
          await getActuator().invokeAction("setLightingIntensity", intensity);
          log.info({ lux, intensity }, "lighting intensity adjusted");
        }
      } catch (err) {
        log.error(err, "failed to adjust lighting intensity");
      }
    }

    try {
      const accRaw = await getSensor().readProperty("acceleration");
      const acc = await accRaw.value() as { x: number, y: number, z: number };
      await writeAcceleration(acc.x, acc.y, acc.z);
      log.info({ acc }, "acceleration written");
    } catch (err) {
      log.error(err, "failed to read/write acceleration");
    }

  }, CONFIG.polling.intervalMs);

  log.info({ intervalMs: CONFIG.polling.intervalMs }, "sensor poller started");
}

export function stopSensorPoller(): void {
  clearInterval(pollingInterval);
  log.info("sensor poller stopped");
}