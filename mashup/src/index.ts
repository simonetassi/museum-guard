import Servient from "@node-wot/core";
import { initConsumer } from "./wot/consumer";
import { HttpClientFactory } from "@node-wot/binding-http";
import { closeInfluxWriter, initInflux } from "./storage/influxWriter";
import { startSensorPoller, stopSensorPoller } from "./collection/sensorPoller";
import pino from "pino";
import { startEventHandler, stopEventHandler } from "./control/eventHandler";

const log = pino({ name: "mashup" });

async function main(): Promise<void> {
  const servient = new Servient();
  servient.addClientFactory(new HttpClientFactory());

  const wot = await servient.start();
  
  await initConsumer(wot);
  log.info("WoT Things consumed successfully");

  initInflux();
  log.info("InfluxDB writer initialized");
  
  startSensorPoller();
  await startEventHandler();

  process.on("SIGINT", async () => {
    log.info("Shutting down...");
    stopSensorPoller();
    stopEventHandler();
    closeInfluxWriter();
    await servient.shutdown();
    log.info("Shutdown complete");
    process.exit(0);
  });
}

main().catch((err) => {
  log.error(err, "Fatal error during startup");
  process.exit(1);
});