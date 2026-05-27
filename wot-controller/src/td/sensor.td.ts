export const SENSOR_TD: Record<string, unknown> = {
  "@context": "https://www.w3.org/2022/wot/td/v1.1",
  id: "urn:museumguard:sensor",
  title: "museumguard-sensor",
  description: "ESP-SEN sensing node: ambient light and accelerometer",
  securityDefinitions: { nosec_sc: { scheme: "nosec" } },
  security: ["nosec_sc"],

  properties: {
    ambientLight: {
      type: "number",
      unit: "lux",
      readOnly: true,
      observable: true,
      description: "Current ambient light intensity",
    },
    accelerationX: {
      type: "number",
      unit: "m/s2",
      readOnly: true,
      observable: true,
    },
    accelerationY: {
      type: "number",
      unit: "m/s2",
      readOnly: true,
      observable: true,
    },
    accelerationZ: {
      type: "number",
      unit: "m/s2",
      readOnly: true,
      observable: true,
    },
  },

  events: {
    impactDetected: {
      description: "Accidental impact event detected",
      data: {
        type: "object",
        properties: {
          value: { type: "number" },
          timestamp: { type: "string" },
        },
      },
    },
    theftDetected: {
      description: "Theft event detected",
      data: {
        type: "object",
        properties: {
          value: { type: "number" },
          timestamp: { type: "string" },
        },
      },
    },
  },
};
