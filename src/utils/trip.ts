import type { Trip } from '../types/trip';
import type { CatchMedia } from '../types/catch';
import { to12h } from './time';

/**
 * "2026-11-22" → local date string. Parsing a bare date with `new Date()` treats it as UTC
 * midnight, which can show the previous day west of Greenwich, so build it from parts.
 */
export function formatTripDate(tripDate: string): string {
  const [y, m, d] = tripDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString();
}

/** Compact date for tight spaces: "Nov 23", or "Nov 23, 2025" when it isn't this year. */
export function formatShortDate(tripDate: string): string {
  const [y, m, d] = tripDate.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: y === new Date().getFullYear() ? undefined : 'numeric',
  });
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

/** Longest trip, in calendar days (matches TripSpan.MaxDays in the API). */
export const MAX_TRIP_DAYS = 7;

export function isMultiDay(trip: { tripDate: string; endDate?: string | null }): boolean {
  return !!trip.endDate && trip.endDate > trip.tripDate;
}

/** "11/20/2026" or, for a multi-day trip, "11/20/2026 – 11/22/2026 (3 days)". */
export function formatTripDates(trip: { tripDate: string; endDate?: string | null }): string {
  if (!isMultiDay(trip)) return formatTripDate(trip.tripDate);
  const days = daysBetween(trip.tripDate, trip.endDate!) + 1;
  return `${formatTripDate(trip.tripDate)} – ${formatTripDate(trip.endDate!)} (${days} days)`;
}

/** Whole calendar days from a to b ("YYYY-MM-DD"). */
export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** "06:00–16:00", or "06:00 → 16:00" for a multi-day trip (start on day 1, end on the last day). */
export function timeRange(trip: Trip): string | null {
  const start = to12h(toTimeInput(trip.startTime));
  const end = to12h(toTimeInput(trip.endTime));
  if (start && end) return isMultiDay(trip) ? `${start} → ${end}` : `${start}–${end}`;
  if (start && !end) return `from ${start}`;
  return start || end || null;
}

/** The trip's last fishing day: its end date, the next morning for a night session, or the same day. */
export function lastTripDay(tripDate: string, endDate: string | null, start: string, end: string): string {
  if (endDate && endDate > tripDate) return endDate;
  if (start && end && end < start) return addDaysToDate(tripDate, 1);
  return tripDate;
}

/** Every date from first to last ("YYYY-MM-DD"), capped at the longest trip. */
export function tripDays(first: string, last: string): string[] {
  const n = Math.min(Math.max(daysBetween(first, last), 0), MAX_TRIP_DAYS - 1);
  return Array.from({ length: n + 1 }, (_, i) => addDaysToDate(first, i));
}

/**
 * The moments whose conditions are saved with the trip, matching the API (TripSpan.ConditionMoments):
 * a session under 24 hours → its middle (05:30–09:30 → 07:30; 22:00–04:00 → 01:00 next day);
 * a longer trip → the middle of the hours fished on each day; no end yet → the start.
 */
export function conditionMoments(
  tripDate: string,
  endDate: string | null,
  start: string,
  end: string,
): { date: string; time: string | null }[] {
  if (!tripDate) return [];
  if (!start) return [{ date: tripDate, time: null }];
  if (!end) return [{ date: tripDate, time: start }];

  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const last = lastTripDay(tripDate, endDate, start, end);
  const from = toMin(start);
  const to = daysBetween(tripDate, last) * 1440 + toMin(end);
  const at = (m: number) => ({
    date: addDaysToDate(tripDate, Math.floor(m / 1440)),
    time: `${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
  });

  if (to - from < 1440) return [at(Math.floor((from + to) / 2))];

  const moments: { date: string; time: string | null }[] = [];
  for (let day = 0; day * 1440 < to; day++) {
    const ws = Math.max(from, day * 1440);
    const we = Math.min(to, (day + 1) * 1440);
    if (we - ws < 60) continue;
    moments.push(at(Math.floor((ws + we) / 2)));
  }
  return moments;
}

/** "2026-11-23" plus n days, as "YYYY-MM-DD" (calendar arithmetic, no time zone shifts). */
export function addDaysToDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Current local time as "HH:mm" for <input type="time">. */
export function nowTimeInput(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
