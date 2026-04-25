import type { TimeSlotHour } from "../timeSlots";
import { TIME_SLOT_HOURS } from "../timeSlots";
import type { CampusCommitment } from "./types";

/**
 * Maps a commitment "HH:MM" start time to the nearest 2-hour routing slot.
 */
export function commitmentTimeToNearestSlot(startTime: string): TimeSlotHour {
  const [hStr, mStr] = startTime.split(":");
  const h = Number.parseInt(hStr, 10);
  const m = Number.parseInt(mStr ?? "0", 10);
  if (Number.isNaN(h)) return 10;
  const decimal = h + (Number.isNaN(m) ? 0 : m / 60);
  let best: TimeSlotHour = TIME_SLOT_HOURS[0];
  let bestD = Infinity;
  for (const s of TIME_SLOT_HOURS) {
    const d = Math.abs(s - decimal);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

/**
 * Representative forecast / shade anchor: median commitment's nearest slot (by start time order).
 */
export function representativeTimeSlotForCommitments(commitments: CampusCommitment[]): TimeSlotHour {
  if (commitments.length === 0) return 12;
  const sorted = [...commitments].sort((a, b) => a.startTime.localeCompare(b.startTime));
  const mid = Math.floor(sorted.length / 2);
  return commitmentTimeToNearestSlot(sorted[mid].startTime);
}
