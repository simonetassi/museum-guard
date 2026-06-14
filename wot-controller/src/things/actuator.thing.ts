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

  let variableLedIntensity = 0;
  let variableLedTimestamp = new Date().toISOString();

  const setVariableLedIntensity = (v: number) => {
    variableLedIntensity = v;
    variableLedTimestamp = new Date().toISOString();
    thing.emitPropertyChange("variableLedIntensity");
  };

  thing.setPropertyReadHandler("variableLedIntensity", async () => ({
    value: variableLedIntensity,
    timestamp: variableLedTimestamp,
  }));

  // The fixed alarm LED is owned by the device: the firmware times the impact
  // blink and auto-resets itself after the blink duration. Proxy the device state
  // so the controller always reflects reality (single source of truth) rather than
  // tracking a duplicate timer.
  thing.setPropertyReadHandler("fixedLedState", async () => {
    const state = await getActuatorState();
    return { value: state.fixedLedState, timestamp: state.timestamp };
  });

  thing.setActionHandler("setLightingIntensity", async (params) => {
    const intensity = await params.value() as number;
    await setIntensity(intensity);
    setVariableLedIntensity(intensity);
    return undefined;
  });

  thing.setActionHandler("triggerImpactAlarm", action(async () => {
    await startBlink();
    thing.emitPropertyChange("fixedLedState");
    log.warn("Impact alarm started — device blinks fixed LED and auto-resets");
  }));

  thing.setActionHandler("triggerTheftAlarm", action(async () => {
    await activateAlarm();
    thing.emitPropertyChange("fixedLedState");
    log.warn("Theft alarm activated — LED latched on");
  }));

  thing.setActionHandler("resetAlarms", action(async () => {
    await resetAlarms();
    thing.emitPropertyChange("fixedLedState");
    log.info("All alarms reset");
  }));

  await thing.expose();
  return thing;
}
