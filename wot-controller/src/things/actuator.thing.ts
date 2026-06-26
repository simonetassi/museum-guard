import * as WoT from "wot-typescript-definitions";
import pino from "pino";
import { ACTUATOR_TD } from "../td/actuator.td";
import { activateAlarm, getActuatorState, resetAlarms, setIntensity, startBlink } from "../adapters/actuator-client.adapter";

const log = pino({ name: "actuatorThing" });

// to avoid always returning undefined (as required by WoT.ActionHandler )
const action = (fn: () => Promise<void>): WoT.ActionHandler =>
  async () => { await fn(); return undefined; };

export async function produceActuatorThing(wot: typeof WoT): Promise<WoT.ExposedThing> {
  const thing = await wot.produce(ACTUATOR_TD as WoT.ExposedThingInit);

  thing.setPropertyReadHandler("variableLedIntensity", async () => {
    const state = await getActuatorState();
    return { value: state.variableLedIntensity, timestamp: state.timestamp };
  });

  thing.setPropertyReadHandler("fixedLedState", async () => {
    const state = await getActuatorState();
    return { value: state.fixedLedState, timestamp: state.timestamp };
  });

  thing.setActionHandler("setLightingIntensity", async (params) => {
    const intensity = await params.value() as number;
    await setIntensity(intensity);
    thing.emitPropertyChange("variableLedIntensity");
    return undefined;
  });

  thing.setActionHandler("triggerImpactAlarm", action(async () => {
    await startBlink();
    thing.emitPropertyChange("fixedLedState");
    log.warn("Impact alarm started");
  }));

  thing.setActionHandler("triggerTheftAlarm", action(async () => {
    await activateAlarm();
    thing.emitPropertyChange("fixedLedState");
    log.warn("Theft alarm activated");
  }));

  thing.setActionHandler("resetAlarms", action(async () => {
    await resetAlarms();
    thing.emitPropertyChange("fixedLedState");
    log.info("All alarms reset");
  }));

  await thing.expose();
  return thing;
}
