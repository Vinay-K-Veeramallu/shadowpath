export interface WeatherData {
  heatIndex: number;          // °F
  temperature: number;        // °F
  relativeHumidity: number;   // 0-100 %
  windSpeedMps: number;       // m/s at 10m
  cloudCoverPct: number;      // 0-100 %, parsed from NWS shortForecast text
  shortForecast: string;      // e.g. "Mostly Sunny", "Partly Cloudy", "Thunderstorms"
  confidence: "High" | "Medium" | "Low";
  source: "nws-live" | "nws-forecast" | "demo-fallback";
  forecastFor: Date | null;
  fetchedAt: Date | null;
}
