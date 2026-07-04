# mashup

WoT consumer application. Consumes the sensor and actuator Things from the
controller, drives the light/acceleration poll cadence, applies the lighting
forecast, and writes all data to InfluxDB.

## Run

```bash
cd mashup
npm install
cp .env.example .env          # then set INFLUX_TOKEN
npm start
```
