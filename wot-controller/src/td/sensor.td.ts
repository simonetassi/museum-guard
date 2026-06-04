export const SENSOR_TD: Record<string, unknown> = {
  "@context": "https://www.w3.org/2022/wot/td/v1.1",
  id: "urn:museumguard:sensor",
  title: "museumguard-sensor",
  description: "ESP-SEN sensing node: ambient light and accelerometer",
  securityDefinitions: { nosec_sc: { scheme: "nosec" } },
  security: ["nosec_sc"],

  properties: {
    ambientLight: {
      type: "object",
      readOnly: true,
      description: "Current ambient light intensity with device timestamp",
      properties: {
        value: { type: "number", unit: "lux" },
        timestamp: { type: "string", format: "date-time" },
      },
    },
    acceleration: {
      type: "object",
      readOnly: true,
      description: "Current acceleration on the X/Y/Z axes with device timestamp",
      properties: {
        x: { type: "number", unit: "m/s2" },
        y: { type: "number", unit: "m/s2" },
        z: { type: "number", unit: "m/s2" },
        timestamp: { type: "string", format: "date-time" },
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
