import { CONFIG } from "../config";
import { writeAcceleration, writeLightMeasurement } from "../storage/influxWriter";
import { getSensor } from "../wot/consumer";
import pino from "pino";

const log = pino({ name: "sensorPoller" });

let pollingInterval: ReturnType<typeof setInterval>;

export function startSensorPoller(): void {
  pollingInterval = setInterval(async () => {
    try {
      const lightRaw = await getSensor().readProperty("ambientLight");
      const lux = await lightRaw.value() as number;
      await writeLightMeasurement(lux);
      log.info({ lux }, "ambient light written");
    } catch (err) {
      log.error(err, "failed to read/write ambient light");
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