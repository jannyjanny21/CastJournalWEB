import type { Trip } from '../types/trip';
import type { CatchMedia } from '../types/catch';

/**
 * "2026-11-22" → local date string. Parsing a bare date with `new Date()` treats it as UTC
 * midnight, which can show the previous day west of Greenwich, so build it from parts.
 */
export function formatTripDate(tripDate: string): string {
  const [y, m, d] = tripDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
}

/** "05:30:00" → "05:30" for <input type="time">. */
export function toTimeInput(value: string | null): string {
  return value ? value.slice(0, 5) : '';
}

/** "05:30" → "05:30:00" (the API's TimeOnly format), or null when empty. */
export function fromTimeInput(value: string): string | null {
  return value ? `${value}:00` : null;
}

/** The trip's own title, or a sensible fallback built from its catches. */
export function tripHeading(trip: Trip): string {
  if (trip.title) return trip.title;
  const names = [...new Set(trip.catches.map((c) => c.speciesName).filter(Boolean))] as string[];
  if (names.length === 0) return trip.catchCount === 0 ? 'Fishing trip' : `${trip.catchCount} catches`;
  if (names.length <= 2) return names.join(' & ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
}

/** First photo or video across the trip's catches, for the card cover. */
export function tripCoverMedia(trip: Trip): CatchMedia | undefined {
  for (const c of trip.catches) {
    const first = [...c.media].sort((a, b) => a.orderIndex - b.orderIndex)[0];
    if (first) return first;
  }
  return undefined;
}

export function timeRange(trip: Trip): string | null {
  const start = toTimeInput(trip.startTime);
  const end = toTimeInput(trip.endTime);
  if (start && end) return `${start}–${end}`;
  return start || end || null;
}
