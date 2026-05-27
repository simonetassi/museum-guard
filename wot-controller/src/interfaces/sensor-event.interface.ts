export enum EventType {
  Impact = "impact",
  Theft = "theft",
}

export interface SensorEvent {
  type: EventType;
  value: number;
  timestamp: string;
}
