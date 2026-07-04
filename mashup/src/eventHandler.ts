import pino from "pino";
import * as WoT from "wot-typescript-definitions";
import { getActuator, getSensor } from "./consumer";
import { writeEvent } from "./influxWriter";
import { EventType } from "./types";

const log = pino({ name: "eventHandler" });

let impactSub: WoT.Subscription;
let theftSub: WoT.Subscription;

export async function startEventHandler(): Promise<void> {
  impactSub = await getSensor().subscribeEvent("impactDetected", async (data) => {
    const { value, timestamp } = await data.value() as { value: number; timestamp: string };
    log.info({ value }, "impactDetected event received");

    await writeEvent(EventType.IMPACT, value, new Date(timestamp)).catch((err) =>
      log.error(err, "failed to write impact event to InfluxDB"),
    );

    await getActuator().invokeAction("triggerImpactAlarm").catch((err) =>
      log.error(err, "failed to invoke triggerImpactAlarm"),
    );
  });

  theftSub = await getSensor().subscribeEvent("theftDetected", async (data) => {
    const { value, timestamp } = await data.value() as { value: number; timestamp: string };
    log.info({ value }, "theftDetected event recieved");

    await writeEvent(EventType.THEFT, value, new Date(timestamp)).catch((err) =>
      log.error(err, "failed to write theft event to InfluxDB"),
    );

    await getActuator().invokeAction("triggerTheftAlarm").catch((err) => 
      log.error(err, "failed to invoke triggerTheftAlarm"),
    )
  });

  log.info("event handler started");
}

export function stopEventHandler(): void {
  impactSub?.stop();
  theftSub?.stop();
  log.info("event handler stopped");
}