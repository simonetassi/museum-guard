import axios, { AxiosError } from "axios";
import pino from "pino";
import { CONFIG } from "../config";
import { ActuatorState } from "../interfaces";

const log = pino({ name: "actuatorClient" });

const http = axios.create({
  baseURL: `http://${CONFIG.espAct.host}:${CONFIG.espAct.httpPort}`,
  timeout: 5000,
});

function handleError(err: unknown, message: string): never {
  if (err instanceof AxiosError) {
    log.error({ status: err.response?.status, message: err.message }, message);
  } else {
    log.error({ err }, message);
  }
  throw err;
}

export async function getActuatorState(): Promise<ActuatorState> {
  try {
    const { data } = await http.get<ActuatorState>(CONFIG.espAct.endpoints.getState);
    return data;
  } catch (err) {
    handleError(err, "Failed to get actuator state");
  }
}

export async function setIntensity(value: number): Promise<void> {
  if (value < 0 || value > 100) {
    throw new RangeError(`Intensity must be 0-100, got ${value}`);
  }
  try {
    await http.post(CONFIG.espAct.endpoints.setIntensity, { intensity: value });
    log.info({ value }, "Intensity set");
  } catch (err) {
    handleError(err, "Failed to set intensity");
  }
}

export async function startBlink(): Promise<void> {
  await http.post(CONFIG.espAct.endpoints.startBlink, {});
  log.info("impact alarm activated");

}

export async function activateAlarm(): Promise<void> {
  await http.post(CONFIG.espAct.endpoints.activateAlarm, {});
  log.info("theft alarm activated");
}

export async function resetAlarms(): Promise<void> {
  await http.post(CONFIG.espAct.endpoints.resetAlarms, {});
}
