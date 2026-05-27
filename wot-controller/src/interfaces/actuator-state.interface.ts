export enum FixedLedState {
  Off = "off",
  Blinking = "blinking",
  On = "on",
}

export interface ActuatorState {
  variableLedIntensity: number;
  fixedLedState: FixedLedState;
  timestamp: string;
}
