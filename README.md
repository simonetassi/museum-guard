# Museum-Guard

A distributed IoT system, built on the W3C **Web of Things**, that protects a
museum artefact from **impact** and **theft** and keeps the conservation
lighting at a safe level. A CoAP sensor node and an HTTP actuator node are both
exposed as uniform Things behind a single controller.

## Components

- `esp-sen/` — ESP32 sensor firmware (CoAP, MPU-6050 + LDR, on-device detection)
- `esp-act/` — ESP32 actuator firmware (HTTP, PWM lamp + alarm LED)
- `wot-controller/` — WoT Producer, bridges CoAP/HTTP
- `mashup/` — WoT Consumer: control logic + InfluxDB writes
- `light-forecast/` — optional ARIMA light forecast (FastAPI)
- `telegram-bot/` — WoT Consumer: threat alerts to Telegram
- `grafana/` — dashboard provisioning

See each subdirectory's README for details.
