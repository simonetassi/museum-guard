import * as WoT from "wot-typescript-definitions";
import pino from "pino";
import { CONFIG } from "../config";
import { ACTUATOR_TD } from "../td/actuator.td";
import { activateAlarm, resetAlarms, setIntensity, startBlink } from "../adapters/actuator-client.adapter";
import { FixedLedState } from "../interfaces";

const log = pino({ name: "actuatorThing" });

let blinkTimer: NodeJS.Timeout | null = null;

// to avoid always returning undefined (as required by WoT.ActionHandler )
const action = (fn: () => Promise<void>): WoT.ActionHandler =>
  async () => { await fn(); return undefined; };

export async function produceActuatorThing(wot: typeof WoT): Promise<WoT.ExposedThing> {
  const thing = await wot.produce(ACTUATOR_TD as WoT.ExposedThingInit);

  let variableLedIntensity = 0;
  let fixedLedState: FixedLedState = FixedLedState.Off;

  const setFixedLedState = (s: FixedLedState) => {
    fixedLedState = s;
    thing.emitPropertyChange("fixedLedState");
  };

  const setVariableLedIntensity = (v: number) => {
    variableLedIntensity = v;
    thing.emitPropertyChange("variableLedIntensity");
  };

  thing.setPropertyReadHandler("variableLedIntensity", async () => variableLedIntensity);
  thing.setPropertyReadHandler("fixedLedState", async () => fixedLedState);

  thing.setActionHandler("setLightingIntensity", async (params) => {
    const intensity = await params.value() as number;
    await setIntensity(intensity);
    setVariableLedIntensity(intensity);
    return undefined;
  });

  thing.setActionHandler("triggerImpactAlarm", action(async () => {
    await startBlink();
    setFixedLedState(FixedLedState.Blinking);
    log.warn("Impact alarm started — blink for %dms", CONFIG.alarms.blinkDurationMs);

    if (blinkTimer !== null) clearTimeout(blinkTimer);
    blinkTimer = setTimeout(async () => {
      blinkTimer = null;
      try {
        await resetAlarms();
      } catch (err) {
        log.error({ err }, "Failed to auto-reset blink alarm on device");
      }
      setFixedLedState(FixedLedState.Off);
      log.info("Blink alarm expired — LED off");
    }, CONFIG.alarms.blinkDurationMs);
  }));

  thing.setActionHandler("triggerTheftAlarm", action(async () => {
    if (blinkTimer !== null) {
      clearTimeout(blinkTimer);
      blinkTimer = null;
    }
    await activateAlarm();
    setFixedLedState(FixedLedState.On);
    log.warn("Theft alarm activated — LED latched on");
  }));

  thing.setActionHandler("resetAlarms", action(async () => {
    await resetAlarms();
    if (blinkTimer !== null) {
      clearTimeout(blinkTimer);
      blinkTimer = null;
    }
    setFixedLedState(FixedLedState.Off);
    log.info("All alarms reset");
  }));

  await thing.expose();
  return thing;
}

export function stopActuatorThing(): void {
  if (blinkTimer !== null) {
    clearTimeout(blinkTimer);
    blinkTimer = null;
  }
}