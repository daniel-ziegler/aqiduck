export interface sensorData {
  AQI?: number;
  AQICategory?: string;
  AQIColorHex?: string;
  temperature?: number;
  error?: any;
}

export interface Sensor {
  sensorId: string | number;
  getData: () => Promise<sensorData>;
}

