import * as WoT from "wot-typescript-definitions";
import { CONFIG } from "../config";

let consumedSensor: WoT.ConsumedThing;
let consumedActuator: WoT.ConsumedThing;

export async function initConsumer(wot: typeof WoT) {
  const sensorTD = await wot.requestThingDescription(CONFIG.sensor.tdUrl);
  consumedSensor = await wot.consume(sensorTD);

  const actuatorTD = await wot.requestThingDescription(CONFIG.actuator.tdUrl);
  consumedActuator = await wot.consume(actuatorTD);
}

export function getSensor(): WoT.ConsumedThing {
  if (!consumedSensor) throw new Error('Sensor Consumer not initialized');
  return consumedSensor;
}

export function getActuator(): WoT.ConsumedThing {
  if (!consumedActuator) throw new Error('Actuator Consumer not initialized');
  return consumedActuator;
}