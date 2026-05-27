import { HttpServer } from "@node-wot/binding-http";
import Servient from "@node-wot/core";
import { CONFIG } from "./config";
import { produceSensorThing, stopSensorThing } from "./things/sensor.thing";
import { produceActuatorThing, stopActuatorThing } from "./things/actuator.thing";
import pino from "pino";

const log = pino({ name: "controller" });

async function main(): Promise<void> {
  const servient = new Servient();
  servient.addServer(new HttpServer({port: CONFIG.controller.httpPort}));

  const wot = await servient.start();

  await produceSensorThing(wot);
  await produceActuatorThing(wot);

  const port = CONFIG.controller.httpPort;
  log.info(`MuseumGuard WoT Controller running on port ${port}`);
  log.info(`  Sensor TD:   http://localhost:${port}/museumguard-sensor`);
  log.info(`  Actuator TD: http://localhost:${port}/museumguard-actuator`);

  process.on("SIGINT", async () => {
    log.info("Shutting down...");
    stopSensorThing();
    stopActuatorThing();
    await servient.shutdown();
    log.info("Controller shut down.");
    process.exit(0);
  })
}

main().catch((err) => {
  log.error(err);
  process.exit(1);
});