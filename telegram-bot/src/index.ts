import Servient from "@node-wot/core";
import { HttpClientFactory } from "@node-wot/binding-http";
import { CONFIG } from "./config";
import { notifyTelegram } from "./notifier";
import pino from "pino";

const log = pino({ name: "telegramBot" });

async function main(): Promise<void> {
  const servient = new Servient();
  servient.addClientFactory(new HttpClientFactory());

  const wot = await servient.start()

  const sensorTD = await wot.requestThingDescription(CONFIG.sensor.tdUrl);
  const sensor = await wot.consume(sensorTD);

  const impactSub = await sensor.subscribeEvent("impactDetected", async (data) => {
    const { value, timestamp } = await data.value() as { value: number; timestamp: string };
    await notifyTelegram(`⚠️ <b>Impact detected</b>\nValue: ${value}\nTime: ${timestamp}`)
      .catch((err) => log.error(err, "failed to send impact alert"));
  });

  const theftSub = await sensor.subscribeEvent("theftDetected", async (data) => {
    const { value, timestamp } = await data.value() as { value: number; timestamp: string };
    await notifyTelegram(`🚨 <b>Theft detected</b>\nValue: ${value}\nTime: ${timestamp}`)
      .catch((err) => log.error(err, "failed to send theft alert"));
  });

  process.on("SIGINT", async () => {
    log.info("Shutting down");
    impactSub.stop();
    theftSub.stop();
    await servient.shutdown();
    process.exit(0);
  });
}

main().catch((err) => {
  log.error(err, "Error during startup");
  process.exit(1);
});