import { CONFIG } from "./config";
import pino from "pino";

const log = pino({ name: "forecastClient" });

export async function getPredictedLux(horizonS: number): Promise<number | null> {
  const url = `${CONFIG.forecast.url}/forecast?horizon_s=${horizonS}`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      log.error({ status: res.status }, "forecast request failed");
      return null;
    }
    const data = await res.json() as { predicted_lux: number; fallback: boolean };
    return data.predicted_lux;
  } catch (err) {
    log.error(err, "failed to fetch forecast");
    return null;
  }
}
