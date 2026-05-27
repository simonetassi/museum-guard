import "dotenv/config";

export const CONFIG = {
  controller: {
    httpPort: Number(process.env.CONTROLLER_HTTP_PORT) || 8080,
  },

  espSen: {
    host: process.env.ESP_SEN_HOST || "192.168.1.101",
    coapPort: Number(process.env.ESP_SEN_COAP_PORT) || 5683,
    pollingIntervalMs: Number(process.env.ESP_SEN_POLLING_INTERVAL_MS) || 2000,
    resources: {
      ambientLight: process.env.ESP_SEN_RES_AMBIENT_LIGHT || "/sensor/light",
      acceleration: process.env.ESP_SEN_RES_ACCELERATION || "/sensor/acceleration",
      impactEvent: process.env.ESP_SEN_RES_IMPACT_EVENT || "/events/impact",
      theftEvent: process.env.ESP_SEN_RES_THEFT_EVENT || "/events/theft",
    },
  },

  espAct: {
    host: process.env.ESP_ACT_HOST || "192.168.1.102",
    httpPort: Number(process.env.ESP_ACT_HTTP_PORT) || 80,
    endpoints: {
      setIntensity: process.env.ESP_ACT_EP_SET_INTENSITY || "/actuator/intensity",
      startBlink: process.env.ESP_ACT_EP_START_BLINK || "/actuator/blink",
      activateAlarm: process.env.ESP_ACT_EP_ACTIVATE_ALARM || "/actuator/alarm",
      resetAlarms: process.env.ESP_ACT_EP_RESET_ALARMS || "/actuator/reset",
      getState: process.env.ESP_ACT_EP_GET_STATE || "/actuator/state",
    },
  },

  alarms: {
    blinkDurationMs: Number(process.env.ALARMS_BLINK_DURATION_MS) || 20000,
  },
};
