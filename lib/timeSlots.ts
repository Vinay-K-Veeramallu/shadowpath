export type TimeSlotHour = 6 | 8 | 10 | 12 | 14 | 16 | 18 | 20;

export const TIME_SLOT_HOURS: TimeSlotHour[] = [6, 8, 10, 12, 14, 16, 18, 20];

export const TIME_SLOT_LABELS: Record<TimeSlotHour, string> = {
  6: "6 AM",
  8: "8 AM",
  10: "10 AM",
  12: "12 PM",
  14: "2 PM",
  16: "4 PM",
  18: "6 PM",
  20: "8 PM",
};

/** Coerce any numeric hour to the nearest valid slot (legacy 10|14|18 are valid). */
export function normalizeTimeSlot(t: number): TimeSlotHour {
  const allowed = TIME_SLOT_HOURS;
  if (allowed.includes(t as TimeSlotHour)) return t as TimeSlotHour;
  return 10;
}

/** Representative local solar time for a slot (hour on the given calendar day, America/Phoenix). */
export function dateTimeForSlot(slot: TimeSlotHour, base: Date = new Date()): Date {
  const d = new Date(base);
  d.setHours(slot, 0, 0, 0);
  return d;
}

export function resolveRouteTimeSlot(params: {
  timeSlot?: TimeSlotHour;
  timeOfDay?: 10 | 14 | 18;
}): TimeSlotHour {
  if (params.timeSlot !== undefined) return params.timeSlot;
  if (params.timeOfDay !== undefined) return params.timeOfDay;
  return 10;
}
