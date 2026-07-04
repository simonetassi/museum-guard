# wot-controller

Central orchestration service. Produces and exposes the two WoT Things
(`museumguard-sensor`, `museumguard-actuator`) over HTTP on port 8080, bridging
the ESP-SEN (CoAP) and ESP-ACT (HTTP) nodes.

## Run

```bash
cd wot-controller
npm install
cp .env.example .env          # then set the ESP-SEN / ESP-ACT hosts
npm start
```
