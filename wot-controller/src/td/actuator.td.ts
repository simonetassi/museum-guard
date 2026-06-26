export const ACTUATOR_TD: Record<string, unknown> = {
  "@context": "https://www.w3.org/2022/wot/td/v1.1",
  id: "urn:museumguard:actuator",
  title: "museumguard-actuator",
  description: "ESP-ACT actuation node: variable LED and alarm LED",
  securityDefinitions: { nosec_sc: { scheme: "nosec" } },
  security: ["nosec_sc"],

  properties: {
    variableLedIntensity: {
      type: "object",
      readOnly: true,
      observable: true,
      description: "Current artwork illumination intensity with timestamp",
      properties: {
        value: { type: "integer", minimum: 0, maximum: 100 },
        timestamp: { type: "string", format: "date-time" },
      },
    },
    fixedLedState: {
      type: "object",
      readOnly: true,
      observable: true,
      description: "Current state of the fixed alarm LED with timestamp",
      properties: {
        value: { type: "string", enum: ["off", "blinking", "on"] },
        timestamp: { type: "string", format: "date-time" },
      },
    },
  },

  actions: {
    setLightingIntensity: {
      description: "Set the artwork illumination intensity",
      input: { type: "integer", minimum: 0, maximum: 100 },
    },
    triggerImpactAlarm: {
      description: "Start 20-second blink alarm after impact detection",
    },
    triggerTheftAlarm: {
      description: "Latch alarm LED permanently on after theft detection",
    },
    resetAlarms: {
      description: "Reset all alarms to off state",
    },
  },
};
