import * as WoT from "wot-typescript-definitions";
import { CONFIG } from "../config";

let consumedSensor: WoT.ConsumedThing;

export async function initConsumer(wot: typeof WoT) {
  const sensorTD = await wot.requestThingDescription(CONFIG.sensor.tdUrl);
  consumedSensor = await wot.consume(sensorTD);
}

export function getSensor(): WoT.ConsumedThing {
  if (!consumedSensor) throw new Error('Consumer not initialized');
  return consumedSensor;
}