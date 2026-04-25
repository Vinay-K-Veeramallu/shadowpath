import { WeatherData } from "./types";
import type { TimeSlotHour } from "../timeSlots";

/** Fallback when NWS is unreachable (≈42 °C, 18 % RH, 2.2 m/s per requirements). */
const DEMO_FALLBACK: WeatherData = {
  heatIndex: 108,
  temperature: 108,
  relativeHumidity: 18,
  windSpeedMps: 2.2,
  confidence: "Low",
  source: "demo-fallback",
  forecastFor: null,
  fetchedAt: null,
};

function parseWindMps(raw: unknown): number {
  if (typeof raw !== "string") return DEMO_FALLBACK.windSpeedMps;
  const numbers = raw.match(/\d+(\.\d+)?/g);
  if (!numbers || numbers.length === 0) return DEMO_FALLBACK.windSpeedMps;
  const mph =
    numbers.length >= 2
      ? (parseFloat(numbers[0]) + parseFloat(numbers[1])) / 2
      : parseFloat(numbers[0]);
  return mph * 0.44704;
}

const NWS_POINTS_URL = "https://api.weather.gov/points/33.4255,-111.9400";

function hourFromPeriod(period: Record<string, unknown>): number | null {
  const startTime = period.startTime as string | undefined;
  if (!startTime) return null;
  return new Date(startTime).getHours();
}

/** Pick the forecast period whose start hour is nearest to `targetHour`. */
function pickPeriodForHour(
  periods: Array<Record<string, unknown>>,
  targetHour: TimeSlotHour
): Record<string, unknown> | undefined {
  let best: { period: Record<string, unknown>; d: number } | undefined;
  for (const period of periods) {
    const h = hourFromPeriod(period);
    if (h === null) continue;
    const d = Math.abs(h - targetHour);
    if (!best || d < best.d) best = { period, d };
  }
  return best?.period;
}

export async function fetchWeather(timeSlot: TimeSlotHour): Promise<WeatherData> {
  try {
    const pointsRes = await fetch(NWS_POINTS_URL, {
      headers: { "User-Agent": "ShadowPath/1.0" },
    });
    if (!pointsRes.ok) return DEMO_FALLBACK;

    const pointsData = await pointsRes.json();
    const forecastHourlyUrl: string | undefined =
      pointsData?.properties?.forecastHourly;
    if (!forecastHourlyUrl) return DEMO_FALLBACK;

    const forecastRes = await fetch(forecastHourlyUrl, {
      headers: { "User-Agent": "ShadowPath/1.0" },
    });
    if (!forecastRes.ok) return DEMO_FALLBACK;

    const forecastData = await forecastRes.json();
    const periods: Array<Record<string, unknown>> =
      forecastData?.properties?.periods;
    if (!Array.isArray(periods) || periods.length === 0) return DEMO_FALLBACK;

    const exact = periods.find((period) => hourFromPeriod(period) === timeSlot);
    const matchingPeriod = exact ?? pickPeriodForHour(periods, timeSlot);
    if (!matchingPeriod) return DEMO_FALLBACK;

    const temperature = matchingPeriod.temperature as number;
    const heatIndex =
      typeof matchingPeriod.heatIndex === "number"
        ? (matchingPeriod.heatIndex as number)
        : temperature;
    const rhRaw = (matchingPeriod.relativeHumidity as { value?: number } | undefined)?.value;
    const relativeHumidity =
      typeof rhRaw === "number" ? rhRaw : DEMO_FALLBACK.relativeHumidity;
    const windSpeedMps = parseWindMps(matchingPeriod.windSpeed);

    const startTime = matchingPeriod.startTime as string;
    const forecastDate = new Date(startTime);
    const now = new Date();
    const hoursAhead =
      (forecastDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    let confidence: "High" | "Medium" | "Low";
    let source: "nws-live" | "nws-forecast";

    if (hoursAhead < 6) {
      confidence = "High";
      source = "nws-live";
    } else if (hoursAhead <= 24) {
      confidence = "Medium";
      source = "nws-forecast";
    } else {
      confidence = "Low";
      source = "nws-forecast";
    }

    return {
      heatIndex,
      temperature,
      relativeHumidity,
      windSpeedMps,
      confidence,
      source,
      forecastFor: forecastDate,
      fetchedAt: new Date(),
    };
  } catch {
    return DEMO_FALLBACK;
  }
}
