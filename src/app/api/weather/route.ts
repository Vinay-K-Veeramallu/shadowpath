import { NextRequest, NextResponse } from "next/server";
import { fetchWeather } from "../../../../lib/weather/fetchWeather";
import type { TimeSlotHour } from "../../../../lib/timeSlots";

const SLOTS = new Set<TimeSlotHour>([6, 8, 10, 12, 14, 16, 18, 20]);

export async function GET(request: NextRequest) {
  const timeParam = request.nextUrl.searchParams.get("time");
  const parsed = timeParam !== null ? Number.parseInt(timeParam, 10) : 10;
  const timeSlot: TimeSlotHour = SLOTS.has(parsed as TimeSlotHour)
    ? (parsed as TimeSlotHour)
    : 10;

  const weather = await fetchWeather(timeSlot);
  return NextResponse.json(weather);
}
