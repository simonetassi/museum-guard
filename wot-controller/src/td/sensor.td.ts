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
      description: "Current ambient light intensity",
    },
    acceleration: {
      type: "object",
      unit: "m/s2",
      readOnly: true,
      description: "Current acceleration on the X/Y/Z axes",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        z: { type: "number" },
      },
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
