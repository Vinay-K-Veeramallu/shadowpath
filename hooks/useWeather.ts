"use client";
import { useState, useEffect } from "react";
import type { WeatherData } from "../lib/weather/types";
import type { TimeSlotHour } from "../lib/timeSlots";

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

function toDateKey(d: Date | null | undefined): string | null {
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function useWeather(timeSlot: TimeSlotHour, forecastDate?: Date | null) {
  const [weather, setWeather] = useState<WeatherData>(DEMO_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dateKey = toDateKey(forecastDate ?? null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ time: String(timeSlot) });
    if (dateKey) params.set("date", dateKey);
    fetch(`/api/weather?${params.toString()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((data: WeatherData) => {
        setWeather(data);
        setError(null);
      })
      .catch(() => {
        setWeather(DEMO_FALLBACK);
        setError("Weather data unavailable, using demo fallback");
      })
      .finally(() => setLoading(false));
  }, [timeSlot, dateKey]);

  return { weather, loading, error };
}
