export interface WeatherData {
  heatIndex: number;          // °F
  temperature: number;        // °F
  relativeHumidity: number;   // 0-100 %
  windSpeedMps: number;       // m/s at 10m
  confidence: "High" | "Medium" | "Low";
  source: "nws-live" | "nws-forecast" | "demo-fallback";
  forecastFor: Date | null;
  fetchedAt: Date | null;
}
