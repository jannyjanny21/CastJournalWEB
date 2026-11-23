import { useId } from 'react';
import type { TideEvent, TidePoint } from '../types/conditions';
import { formatDuration, minutesOfDay, to12h } from '../utils/time';

const W = 320;
const H = 150;
const PAD_X = 10;
const TOP = 26;    // room for "High" labels
const BOTTOM = 44; // room for "Low" labels, then the hour axis below them
const DAY = 24 * 60;

/** Smooth curve through the points without overshooting the real highs and lows (monotone cubic). */
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return '';
  const n = pts.length;
  const dx = pts.slice(1).map((p, i) => p[0] - pts[i][0]);
  const slope = pts.slice(1).map((p, i) => (p[1] - pts[i][1]) / dx[i]);
  const t: number[] = new Array(n);
  t[0] = slope[0];
  t[n - 1] = slope[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${(pts[i][0] + h).toFixed(1)},${(pts[i][1] + h * t[i]).toFixed(1)} ${(pts[i + 1][0] - h).toFixed(1)},${(pts[i + 1][1] - h * t[i + 1]).toFixed(1)} ${pts[i + 1][0].toFixed(1)},${pts[i + 1][1].toFixed(1)}`;
  }
  return d;
}

/** Sea level at a minute of the day, interpolated between the hourly points. */
function heightAt(points: { min: number; h: number }[], min: number): number {
  if (min <= points[0].min) return points[0].h;
  for (let i = 1; i < points.length; i++) {
    if (min <= points[i].min) {
      const a = points[i - 1], b = points[i];
      return a.h + ((b.h - a.h) * (min - a.min)) / (b.min - a.min);
    }
  }
  return points[points.length - 1].h;
}

/**
 * Estimated sea level through the day (FR-14): a filled "water" curve with the highs and lows
 * marked, an hour axis in AM/PM, and — for today — where the tide is now and what comes next.
 */
export function TideChart({
  points,
  events,
  nowTime,
}: {
  points: TidePoint[];
  events: TideEvent[];
  /** Local "HH:mm" when the chart is for today; draws the "Now" marker. */
  nowTime?: string | null;
}) {
  const gradientId = useId();
  if (points.length < 2) return null;

  // Hourly points plus the exact highs and lows, so the curve peaks where the labels say.
  const eventMins = events.map((e) => minutesOfDay(e.time));
  const series = points
    .map((p) => ({ min: minutesOfDay(p.time), h: p.heightM }))
    .filter((p) => !eventMins.some((m) => Math.abs(m - p.min) < 20))
    .concat(events.map((e) => ({ min: minutesOfDay(e.time), h: e.heightM })))
    .sort((a, b) => a.min - b.min);
  const heights = series.map((p) => p.h).concat(events.map((e) => e.heightM));
  const lo = Math.min(...heights), hi = Math.max(...heights);
  const span = hi - lo || 1;

  const x = (min: number) => PAD_X + (min / DAY) * (W - 2 * PAD_X);
  const y = (h: number) => TOP + (1 - (h - lo) / span) * (H - TOP - BOTTOM);

  const curve = smoothPath(series.map((p) => [x(p.min), y(p.h)]));
  const baseY = H - BOTTOM;
  const area = `${curve} L${x(series[series.length - 1].min).toFixed(1)},${baseY} L${x(series[0].min).toFixed(1)},${baseY} Z`;

  const nowMin = nowTime ? minutesOfDay(nowTime) : null;
  const nowH = nowMin != null ? heightAt(series, nowMin) : null;
  const next = nowMin != null ? events.find((e) => minutesOfDay(e.time) > nowMin) : undefined;
  const previous = nowMin != null ? [...events].reverse().find((e) => minutesOfDay(e.time) <= nowMin) : undefined;
  // Heading to a high = rising; just past a high = falling. Only without events, compare heights.
  const rising =
    nowMin == null ? null
    : next ? next.type === 'High'
    : previous ? previous.type === 'Low'
    : heightAt(series, Math.min(nowMin + 30, DAY - 1)) > (nowH ?? 0);

  const ticks = [0, 6, 12, 18, 24];
  const tickLabel = (h: number) => (h === 0 || h === 24 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`);

  const summary = events.length
    ? events.map((e) => `${e.type} tide at ${to12h(e.time)} (${e.heightM.toFixed(2)} m)`).join(', ')
    : 'No clear high or low tide this day';

  return (
    <div className="space-y-1.5">
      {nowMin != null && (
        <p className="m-0 text-sm">
          <span className="mr-1 inline-block size-2.5 rounded-full align-middle" style={{ background: 'var(--color-brass)' }} aria-hidden />
          Now: tide is <strong>{rising ? 'rising ↑' : 'falling ↓'}</strong>
          {next && (
            <span className="text-muted-foreground">
              {' '}· next {next.type.toLowerCase()} at {to12h(next.time)} (in {formatDuration(minutesOfDay(next.time) - nowMin)})
            </span>
          )}
        </p>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xl" role="img" aria-label={`Estimated tide: ${summary}.`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-river)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--color-river)" stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Hour grid */}
        {ticks.map((h) => (
          <g key={h}>
            <line x1={x(h * 60)} x2={x(h * 60)} y1={TOP - 6} y2={H - 14} stroke="currentColor" strokeOpacity="0.08" />
            <text
              x={x(h * 60)}
              y={H - 4}
              fontSize="9"
              textAnchor={h === 0 ? 'start' : h === 24 ? 'end' : 'middle'}
              className="fill-muted-foreground"
            >
              {tickLabel(h)}
            </text>
          </g>
        ))}

        {/* Water */}
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={curve} fill="none" stroke="var(--color-river)" strokeWidth="2" strokeLinecap="round" />

        {/* Highs and lows */}
        {events.map((e) => {
          const ex = x(minutesOfDay(e.time));
          const ey = y(e.heightM);
          const high = e.type === 'High';
          const anchor = ex < 40 ? 'start' : ex > W - 40 ? 'end' : 'middle';
          return (
            <g key={`${e.type}-${e.time}`}>
              <circle cx={ex} cy={ey} r="3.5" fill="var(--color-paper, white)" stroke="var(--color-river)" strokeWidth="2" />
              <text x={ex} y={high ? ey - 14 : ey + 13} fontSize="9" fontWeight="600" textAnchor={anchor} className="fill-foreground">
                {high ? '▲ High' : '▼ Low'}
              </text>
              <text x={ex} y={high ? ey - 5 : ey + 22} fontSize="8.5" textAnchor={anchor} className="fill-muted-foreground">
                {to12h(e.time)}
              </text>
            </g>
          );
        })}

        {/* Now */}
        {nowMin != null && nowH != null && (
          <g>
            <line x1={x(nowMin)} x2={x(nowMin)} y1={TOP - 4} y2={baseY} stroke="var(--color-brass)" strokeWidth="1.25" strokeDasharray="3 3" />
            <circle cx={x(nowMin)} cy={y(nowH)} r="4" fill="var(--color-brass)" />
          </g>
        )}
      </svg>

      {events.length > 0 ? (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {events.map((e) => (
            <li key={`${e.type}-${e.time}`} className="rounded-full border border-border px-2 py-0.5 text-xs">
              {e.type === 'High' ? '▲' : '▼'} {e.type} <strong>{to12h(e.time)}</strong>{' '}
              <span className="text-muted-foreground">{e.heightM.toFixed(2)} m</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-xs text-muted-foreground">No clear high or low this day.</p>
      )}
      <p className="m-0 text-xs text-muted-foreground">
        Heights are relative to mean sea level; the curve shows the change through the day.
      </p>
    </div>
  );
}
