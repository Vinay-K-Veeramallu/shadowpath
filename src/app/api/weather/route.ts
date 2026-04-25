import { NextRequest, NextResponse } from "next/server";
import { fetchWeather } from "../../../../lib/weather/fetchWeather";
import type { TimeSlotHour } from "../../../../lib/timeSlots";

const SLOTS = new Set<TimeSlotHour>([6, 8, 10, 12, 14, 16, 18, 20]);
export const dynamic = "force-dynamic";

function parseDateParam(raw: string | null): Date | undefined {
  if (!raw) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!m) return undefined;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return undefined;
  return dt;
}

export async function GET(request: NextRequest) {
  const timeParam = request.nextUrl.searchParams.get("time");
  const dateParam = request.nextUrl.searchParams.get("date");
  const parsed = timeParam !== null ? Number.parseInt(timeParam, 10) : 10;
  const timeSlot: TimeSlotHour = SLOTS.has(parsed as TimeSlotHour)
    ? (parsed as TimeSlotHour)
    : 10;

  const forecastDate = parseDateParam(dateParam);

  const weather = await fetchWeather(timeSlot, forecastDate);
  return NextResponse.json(weather, {
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}
