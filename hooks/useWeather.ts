"use client";
import { useState, useEffect } from "react";
import type { WeatherData } from "../lib/weather/types";
import type { TimeSlotHour } from "../lib/timeSlots";

const DEMO_FALLBACK: WeatherData = {
  heatIndex: 108,
  temperature: 108,
  relativeHumidity: 18,
  windSpeedMps: 2.2,
  confidence: "Low",
  source: "demo-fallback",
  fetchedAt: null,
};

export function useWeather(timeSlot: TimeSlotHour) {
  const [weather, setWeather] = useState<WeatherData>(DEMO_FALLBACK);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/weather?time=${timeSlot}`)
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
  }, [timeSlot]);

  return { weather, loading, error };
}
