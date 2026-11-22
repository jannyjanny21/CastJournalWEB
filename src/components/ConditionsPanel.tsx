import { useEffect, useState } from 'react';
import { CloudSun, Moon, Waves, Sunrise, Sunset, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { environmentApi, type ConditionsQuery } from '../api/environment';
import type { Conditions, TidePoint } from '../types/conditions';

function errorText(err: unknown): string {
  return err && typeof err === 'object' && 'message' in err
    ? String((err as { message: unknown }).message)
    : "Couldn't load conditions.";
}

const fmt = (v: number | null | undefined, unit: string, digits = 0) =>
  v == null ? null : `${v.toFixed(digits)}${unit}`;

/** Sea level through the day as a small line chart (FR-14). */
function TideChart({ points }: { points: TidePoint[] }) {
  if (points.length < 2) return null;
  const w = 240, h = 56, pad = 4;
  const heights = points.map((p) => p.heightM);
  const min = Math.min(...heights), max = Math.max(...heights);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (w - 2 * pad)) / (points.length - 1);
  const y = (v: number) => h - pad - ((v - min) * (h - 2 * pad)) / span;
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.heightM).toFixed(1)}`).join(' ');

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-14 w-full" role="img"
      aria-label={`Estimated sea level from ${min.toFixed(2)} m to ${max.toFixed(2)} m during the day`}>
      <polyline points={line} fill="none" stroke="currentColor" strokeWidth="1.5" className="text-brass" />
      <text x={pad} y={h - 1} fontSize="8" className="fill-muted-foreground">00:00</text>
      <text x={w - pad} y={h - 1} fontSize="8" textAnchor="end" className="fill-muted-foreground">23:00</text>
    </svg>
  );
}

function TrendIcon({ trend }: { trend: string | null }) {
  if (trend === 'Rising') return <TrendingUp className="inline size-3.5" aria-label="rising" />;
  if (trend === 'Falling') return <TrendingDown className="inline size-3.5" aria-label="falling" />;
  if (trend === 'Steady') return <Minus className="inline size-3.5" aria-label="steady" />;
  return null;
}

/**
 * Live weather (FR-12), moon (FR-13) and estimated tides (FR-14) for a place and date.
 * Pass null to show nothing (e.g. no location chosen yet).
 */
export function ConditionsPanel({ query, title = 'Conditions' }: { query: ConditionsQuery | null; title?: string }) {
  const key = query ? JSON.stringify(query) : null;
  const [state, setState] = useState<{ key: string; data?: Conditions; error?: string } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    // Small delay so typing a date or time doesn't fire a request per keystroke.
    const timer = window.setTimeout(() => {
      environmentApi
        .get(JSON.parse(key) as ConditionsQuery)
        .then((data) => { if (!cancelled) setState({ key, data }); })
        .catch((err) => { if (!cancelled) setState({ key, error: errorText(err) }); });
    }, 400);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [key]);

  if (!key) return null;
  const current = state?.key === key ? state : null;

  return (
    <div className="space-y-3 rounded-lg border border-border p-3 text-sm">
      <div className="flex items-baseline justify-between gap-2">
        <strong>{title}</strong>
        {current?.data?.localTime && (
          <span className="font-mono text-xs text-muted-foreground">
            {current.data.date} · {current.data.localTime}
          </span>
        )}
      </div>

      {!current && <p className="text-muted-foreground">Loading conditions…</p>}
      {current?.error && <p className="text-destructive">{current.error}</p>}

      {current?.data && (() => {
        const c = current.data;
        const w = c.weather;
        return (
          <>
            <section>
              <div className="mb-1 flex items-center gap-1.5 font-medium"><CloudSun className="size-4" /> Weather</div>
              {w ? (
                <div className="space-y-0.5">
                  <div>
                    {w.description}
                    {w.temperatureC != null && <>, {fmt(w.temperatureC, '°C', 1)}</>}
                    {w.apparentTemperatureC != null && w.temperatureC != null &&
                      Math.abs(w.apparentTemperatureC - w.temperatureC) >= 1 && <> (feels {fmt(w.apparentTemperatureC, '°C')})</>}
                  </div>
                  <div className="text-muted-foreground">
                    {[
                      w.windSpeedKmh != null && `Wind ${fmt(w.windSpeedKmh, ' km/h')}${w.windDirection ? ` ${w.windDirection}` : ''}`,
                      w.humidityPercent != null && `Humidity ${fmt(w.humidityPercent, '%')}`,
                      w.precipitationProbabilityPercent != null && `Rain chance ${fmt(w.precipitationProbabilityPercent, '%')}`,
                    ].filter(Boolean).join(' · ')}
                  </div>
                  {w.pressureHpa != null && (
                    <div className="text-muted-foreground">
                      Pressure {fmt(w.pressureHpa, ' hPa')} <TrendIcon trend={w.pressureTrend} /> {w.pressureTrend?.toLowerCase()}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Weather unavailable.</p>
              )}
              {c.sun && (c.sun.sunrise || c.sun.sunset) && (
                <div className="mt-1 flex gap-4 text-muted-foreground">
                  {c.sun.sunrise && <span><Sunrise className="inline size-3.5" /> {c.sun.sunrise}</span>}
                  {c.sun.sunset && <span><Sunset className="inline size-3.5" /> {c.sun.sunset}</span>}
                </div>
              )}
            </section>

            <section>
              <div className="mb-1 flex items-center gap-1.5 font-medium"><Moon className="size-4" /> Moon</div>
              <div>{c.moon.phaseName}, {c.moon.illuminationPercent}% illuminated</div>
              <div className="text-muted-foreground">
                {c.moon.alwaysUp ? 'Up all day' : c.moon.alwaysDown ? 'Below the horizon all day' :
                  [c.moon.moonrise && `Rise ${c.moon.moonrise}`, c.moon.moonset && `Set ${c.moon.moonset}`].filter(Boolean).join(' · ')}
              </div>
            </section>

            <section>
              <div className="mb-1 flex items-center gap-1.5 font-medium">
                <Waves className="size-4" /> Tides {c.tide.available && <span className="font-normal text-muted-foreground">(estimated)</span>}
              </div>
              {c.tide.available ? (
                <>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                    {c.tide.events.map((e) => (
                      <span key={`${e.type}-${e.time}`}>
                        {e.type} {e.time} <span className="text-muted-foreground">({e.heightM.toFixed(2)} m)</span>
                      </span>
                    ))}
                    {c.tide.events.length === 0 && <span className="text-muted-foreground">No clear high or low this day.</span>}
                  </div>
                  <TideChart points={c.tide.hourly} />
                  <div className="text-muted-foreground">
                    {[fmt(c.tide.seaSurfaceTemperatureC, '°C water', 1), fmt(c.tide.waveHeightM, ' m waves', 1)].filter(Boolean).join(' · ')}
                  </div>
                  <p className="text-xs text-muted-foreground">Model estimate, not for navigation.</p>
                </>
              ) : (
                <p className="text-muted-foreground">{c.tide.unavailableReason ?? 'Tide data unavailable.'}</p>
              )}
            </section>

            {c.notes.length > 0 && <p className="text-xs text-muted-foreground">{c.notes.join(' ')}</p>}
            <p className="text-xs text-muted-foreground">
              Data: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline">Open-Meteo.com</a> (CC BY 4.0) · Moon: SunCalc
            </p>
          </>
        );
      })()}
    </div>
  );
}
