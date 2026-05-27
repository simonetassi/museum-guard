export const ACTUATOR_TD: Record<string, unknown> = {
  "@context": "https://www.w3.org/2022/wot/td/v1.1",
  id: "urn:museumguard:actuator",
  title: "museumguard-actuator",
  description: "ESP-ACT actuation node: variable LED and alarm LED",
  // securityDefinitions: { nosec_sc: { scheme: "nosec" } },
  // security: ["nosec_sc"],

  properties: {
    variableLedIntensity: {
      type: "integer",
      minimum: 0,
      maximum: 100,
      readOnly: false,
      observable: true,
      description: "Current artwork illumination intensity (0-100)",
    },
    fixedLedState: {
      type: "string",
      enum: ["off", "blinking", "on"],
      readOnly: true,
      observable: true,
      description: "Current state of the fixed alarm LED",
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
