import { WeatherData } from "./types";
import type { TimeSlotHour } from "../timeSlots";

/** Fallback when NWS is unreachable (≈42 °C, 18 % RH, 2.2 m/s per requirements). */
const DEMO_FALLBACK: WeatherData = {
  heatIndex: 108,
  temperature: 108,
  relativeHumidity: 18,
  windSpeedMps: 2.2,
  cloudCoverPct: 10,
  shortForecast: "Sunny",
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

/**
 * Map an NWS shortForecast string to an approximate cloud-cover percentage.
 * NWS sky-cover terminology buckets to standard ranges; we pick a representative midpoint.
 */
function parseCloudCoverPct(shortForecast: string | undefined): number {
  if (!shortForecast || typeof shortForecast !== "string") return 10;
  const f = shortForecast.toLowerCase();
  // Precipitation usually implies heavy cloud cover regardless of "sunny" prefix.
  if (/(thunderstorm|rain|showers|drizzle|snow|sleet|hail)/.test(f)) return 85;
  if (/cloudy/.test(f)) {
    if (/mostly cloudy/.test(f)) return 75;
    if (/partly cloudy/.test(f)) return 50;
    return 95;
  }
  if (/partly sunny/.test(f)) return 55;
  if (/mostly sunny|mostly clear/.test(f)) return 25;
  if (/sunny|clear/.test(f)) return 5;
  if (/fog|haze|smoke/.test(f)) return 60;
  return 35; // unknown wording: assume mixed sky
}

const NWS_POINTS_URL = "https://api.weather.gov/points/33.4255,-111.9400";

interface PeriodMatchTarget {
  hour: TimeSlotHour;
  /** When set, prefer the period whose startTime falls on this calendar day (local). */
  dateKey?: string;
}

function localDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Pick the forecast period closest to the target date+hour, preferring an exact match. */
function pickPeriodForSlotHour(
  periods: Array<Record<string, unknown>>,
  target: PeriodMatchTarget
): Record<string, unknown> | undefined {
  const nowMs = Date.now();
  let bestExact: { period: Record<string, unknown>; t: number } | undefined;
  let bestFuture: { period: Record<string, unknown>; t: number } | undefined;
  let bestAny: { period: Record<string, unknown>; t: number } | undefined;

  for (const period of periods) {
    const startTime = period.startTime as string | undefined;
    if (!startTime) continue;
    const start = new Date(startTime);
    if (Number.isNaN(start.getTime()) || start.getHours() !== target.hour) continue;

    const t = start.getTime();
    if (!bestAny || t < bestAny.t) bestAny = { period, t };
    if (t >= nowMs && (!bestFuture || t < bestFuture.t)) {
      bestFuture = { period, t };
    }
    if (target.dateKey && localDateKey(start) === target.dateKey) {
      if (!bestExact || t < bestExact.t) bestExact = { period, t };
    }
  }

  return bestExact?.period ?? bestFuture?.period ?? bestAny?.period;
}

/**
 * Fetch hourly forecast for a given local hour, optionally for a specific calendar date.
 * Backward compatible: `fetchWeather(timeSlot)` still works for "next upcoming hour".
 */
export async function fetchWeather(
  timeSlot: TimeSlotHour,
  forecastDate?: Date
): Promise<WeatherData> {
  try {
    const pointsRes = await fetch(NWS_POINTS_URL, {
      headers: { "User-Agent": "ShadowPath/1.0" },
      cache: "no-store",
    });
    if (!pointsRes.ok) return DEMO_FALLBACK;

    const pointsData = await pointsRes.json();
    const forecastHourlyUrl: string | undefined =
      pointsData?.properties?.forecastHourly;
    if (!forecastHourlyUrl) return DEMO_FALLBACK;

    const forecastRes = await fetch(forecastHourlyUrl, {
      headers: { "User-Agent": "ShadowPath/1.0" },
      cache: "no-store",
    });
    if (!forecastRes.ok) return DEMO_FALLBACK;

    const forecastData = await forecastRes.json();
    const periods: Array<Record<string, unknown>> =
      forecastData?.properties?.periods;
    if (!Array.isArray(periods) || periods.length === 0) return DEMO_FALLBACK;

    const matchingPeriod = pickPeriodForSlotHour(periods, {
      hour: timeSlot,
      dateKey: forecastDate ? localDateKey(forecastDate) : undefined,
    });
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
    const shortForecast =
      typeof matchingPeriod.shortForecast === "string"
        ? (matchingPeriod.shortForecast as string)
        : "";
    const cloudCoverPct = parseCloudCoverPct(shortForecast);

    const startTime = matchingPeriod.startTime as string;
    const periodDate = new Date(startTime);
    const now = new Date();
    const hoursAhead =
      (periodDate.getTime() - now.getTime()) / (1000 * 60 * 60);

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
      cloudCoverPct,
      shortForecast: shortForecast || (cloudCoverPct < 20 ? "Sunny" : "Mixed"),
      confidence,
      source,
      forecastFor: periodDate,
      fetchedAt: new Date(),
    };
  } catch {
    return DEMO_FALLBACK;
  }
}
