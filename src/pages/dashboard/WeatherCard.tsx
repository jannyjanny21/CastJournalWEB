import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CloudSun, LocateFixed } from 'lucide-react';
import { locationsApi } from '../../api/locations';
import type { Location } from '../../types/location';
import type { ConditionsQuery } from '../../api/environment';
import { ConditionsPanel } from '../../components/ConditionsPanel';
import { hasPosition } from '../../components/map/leaflet';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const STORAGE_KEY = 'castjournal:dashboard-weather-location';
const CURRENT = '__current__';

function readSaved(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}
function save(value: string) {
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* storage unavailable */ }
}

/** Weather, moon and tides right now for a chosen spot or the current position (F-24). */
export function WeatherCard() {
  const [locations, setLocations] = useState<Location[] | null>(null);
  const [choice, setChoice] = useState<string | null>(() => readSaved());
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    locationsApi
      .getMine()
      .then((all) => { if (!cancelled) setLocations(all.filter((l) => hasPosition(l.latitude, l.longitude))); })
      .catch(() => { if (!cancelled) setLocations([]); });
    return () => { cancelled = true; };
  }, []);

  const locateMe = () => {
    if (!navigator.geolocation) {
      setGpsMessage("This browser can't share your location.");
      return;
    }
    setGpsMessage('Finding your location…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsMessage(null);
        setChoice(CURRENT);
        save(CURRENT);
      },
      () => setGpsMessage('Location permission was denied. Pick one of your spots instead.'),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  };

  // Default to the first saved spot; a saved choice that no longer exists falls back too.
  const selected =
    choice === CURRENT
      ? CURRENT
      : locations?.find((l) => l.id === choice)?.id ?? locations?.[0]?.id ?? null;

  const query: ConditionsQuery | null =
    selected === CURRENT ? (gps ? { lat: gps.lat, lng: gps.lng } : null)
    : selected ? { locationId: selected }
    : null;

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 flex items-center gap-2 font-heading text-lg"><CloudSun className="size-5 text-[color:var(--color-river)]" /> Weather now</h2>
          <div className="flex items-center gap-2">
            {locations && locations.length > 0 && (
              <select
                aria-label="Location"
                value={selected ?? ''}
                onChange={(e) => {
                  if (e.target.value === CURRENT) { locateMe(); return; }
                  setChoice(e.target.value);
                  save(e.target.value);
                }}
                className="max-w-48 rounded-md border border-border bg-transparent px-2 py-1 text-sm"
              >
                {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                <option value={CURRENT}>My current location</option>
              </select>
            )}
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button type="button" variant="outline" size="icon-sm" onClick={locateMe} aria-label="Use my current location" />
                }
              >
                <LocateFixed className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <strong className="block">Use my current location</strong>
                Shows the weather, moon and tide where you are right now. Your browser will ask for
                permission first; your position isn't saved.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {gpsMessage && <p className="m-0 text-sm text-muted-foreground">{gpsMessage}</p>}

        {locations === null && <p className="m-0 text-sm text-muted-foreground">Loading…</p>}
        {locations?.length === 0 && selected !== CURRENT && (
          <p className="m-0 text-sm text-muted-foreground">
            Save a fishing spot with a map pin, or use your current location, to see the weather here.{' '}
            <Link to="/locations" className="underline">Add a location</Link>
          </p>
        )}
        {selected === CURRENT && !gps && !gpsMessage && (
          <p className="m-0 text-sm text-muted-foreground">Tap the location button to use where you are now.</p>
        )}

        {query && <ConditionsPanel query={query} title={selected === CURRENT ? 'Your current location' : locations?.find((l) => l.id === selected)?.name} />}

        <p className="m-0 text-xs text-muted-foreground">
          <Link to="/map" className="underline">Find the nearest fishing spots</Link>
        </p>
      </CardContent>
    </Card>
  );
}
