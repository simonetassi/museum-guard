import { CONFIG } from "../config";
import { writeAcceleration, writeFixedLedState, writeLightingIntensity, writeLightMeasurement } from "../storage/influxWriter";
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
      const { value, timestamp } = await lightRaw.value() as { value: number; timestamp: string };
      lux = value;
      await writeLightMeasurement(lux, new Date(timestamp));
      log.info({ lux }, "ambient light written");
    } catch (err) {
      log.error(err, "failed to read/write ambient light");
    }

    if (lux !== null) {
      try {
        const fixedLedStateRaw = await getActuator().readProperty("fixedLedState");
        const { value: fixedLedState, timestamp: ledTs } = await fixedLedStateRaw.value() as { value: string; timestamp: string };
        await writeFixedLedState(fixedLedState, new Date(ledTs));

        if (fixedLedState === "off") {
          const deficit = TARGET_LUX - lux;
          const intensity = Math.round(Math.max(MIN_INTENSITY, Math.min(MAX_INTENSITY, (deficit / TARGET_LUX) * 100)));
          await getActuator().invokeAction("setLightingIntensity", intensity);
          await writeLightingIntensity(intensity, new Date());
          log.info({ lux, intensity }, "lighting intensity adjusted");
        }
      } catch (err) {
        log.error(err, "failed to adjust lighting intensity");
      }
    }

    try {
      const accRaw = await getSensor().readProperty("acceleration");
      const { x, y, z, timestamp } = await accRaw.value() as { x: number; y: number; z: number; timestamp: string };
      await writeAcceleration(x, y, z, new Date(timestamp));
      log.info({ x, y, z }, "acceleration written");
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
