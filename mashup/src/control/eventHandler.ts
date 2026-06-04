import pino from "pino";
import * as WoT from "wot-typescript-definitions";
import { getActuator, getSensor } from "../wot/consumer";
import { writeEvent } from "../storage/influxWriter";
import { EventType } from "../common/types";

const log = pino({ name: "eventHandler" });

let impactSub: WoT.Subscription;
let theftSub: WoT.Subscription;

export async function startEventHandler(): Promise<void> {
  impactSub = await getSensor().subscribeEvent("impactDetected", async (data) => {
    const { value } = await data.value() as { value: number; timestamp: string };
    log.info({ value }, "impactDetected event received");

    await writeEvent(EventType.IMPACT, value).catch((err) => 
      log.error(err, "failed to write impact event to InfluxDB"),
    );

    await getActuator().invokeAction("triggerImpactAlarm").catch((err) =>
      log.error(err, "failed to invoke triggerImpactAlarm"),
    );
  });

  theftSub = await getSensor().subscribeEvent("theftDetected", async (data) => {
    const { value } = await data.value() as { value: number; timestamp: string };
    log.info({ value }, "theftDetected event recieved");

    await writeEvent(EventType.THEFT, value).catch((err) => 
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