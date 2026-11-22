import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { LatLngBounds, type Map as LeafletMap } from 'leaflet';
import { LocateFixed, Crosshair } from 'lucide-react';
import { tripsApi } from '../../api/trips';
import { locationsApi } from '../../api/locations';
import type { NearbyLocation, TripMapLocation } from '../../types/conditions';
import type { ConditionsQuery } from '../../api/environment';
import { DEFAULT_CENTER, DEFAULT_ZOOM, TILE_ATTRIBUTION, TILE_URL } from '../../components/map/leaflet';
import { formatTripDate } from '../../utils/trip';
import { PageHeader } from '../../components/PageHeader';
import { ConditionsPanel } from '../../components/ConditionsPanel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/** Zooms to fit the trip pins once they load. */
function FitToTrips({ points }: { points: TripMapLocation[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const bounds = new LatLngBounds(points.map((p) => [p.latitude, p.longitude] as [number, number]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }, [map, points]);
  return null;
}

function MapRef({ onReady }: { onReady: (m: LeafletMap) => void }) {
  const map = useMap();
  useEffect(() => { onReady(map); }, [map, onReady]);
  return null;
}

function ClickForConditions({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  // wrap(): taps on a repeated copy of the world come back as lng 481 etc.
  useMapEvents({ click: (e) => { const p = e.latlng.wrap(); onPick(p.lat, p.lng); } });
  return null;
}

const tripLabel = (t: TripMapLocation['trips'][number]) =>
  t.title || (t.species.length ? t.species.slice(0, 2).join(' & ') : `${t.catchCount} catches`);

/** "My map": where your trips were (FR-15, FR-24) and the nearest spots (F-15). */
export function MyMap() {
  const [map, setMap] = useState<LeafletMap | null>(null);
  const [trips, setTrips] = useState<TripMapLocation[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nearest, setNearest] = useState<{ from: [number, number]; items: NearbyLocation[] } | null>(null);
  const [nearestMessage, setNearestMessage] = useState<string | null>(null);
  const [conditionsFor, setConditionsFor] = useState<{ label: string; query: ConditionsQuery } | null>(null);

  useEffect(() => {
    tripsApi.getMap().then(setTrips).catch(() => setLoadError('Could not load your trips.'));
  }, []);

  const findNearest = async (lat: number, lng: number) => {
    setNearestMessage(null);
    try {
      const items = await locationsApi.getNearest(lat, lng, 5);
      setNearest({ from: [lat, lng], items });
      if (items.length === 0) setNearestMessage('No saved or public spots yet.');
    } catch {
      setNearestMessage('Could not load nearby spots.');
    }
  };

  const nearestFromGps = () => {
    if (!('geolocation' in navigator)) {
      setNearestMessage('This browser has no location access — use "Nearest to map centre" instead.');
      return;
    }
    setNearestMessage('Finding you…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        map?.flyTo([pos.coords.latitude, pos.coords.longitude], 12, { duration: 0.6 });
        findNearest(pos.coords.latitude, pos.coords.longitude);
      },
      (err) =>
        setNearestMessage(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was refused — use "Nearest to map centre" instead.'
            : "Couldn't get your location — use \"Nearest to map centre\" instead.",
        ),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  const nearestFromCentre = () => {
    if (!map) return;
    const c = map.getCenter().wrap();
    findNearest(c.lat, c.lng);
  };

  return (
    <div>
      <PageHeader title="My Map" />

      <div className="grid gap-4 pt-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className="isolate h-[60vh] min-h-80 overflow-hidden rounded-lg border border-border">
            <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
              <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
              <MapRef onReady={setMap} />
              <FitToTrips points={trips} />
              <ClickForConditions
                onPick={(lat, lng) =>
                  setConditionsFor({ label: `${lat.toFixed(3)}, ${lng.toFixed(3)}`, query: { lat, lng } })}
              />

              {trips.map((loc) => (
                <Marker key={loc.locationId} position={[loc.latitude, loc.longitude]}>
                  <Popup>
                    <strong>{loc.name}</strong>
                    <ul className="m-0 mt-1 list-none p-0">
                      {loc.trips.slice(0, 6).map((t) => (
                        <li key={t.id}>
                          <Link to={`/trips/${t.id}`}>{formatTripDate(t.tripDate)} · {tripLabel(t)}</Link>
                        </li>
                      ))}
                      {loc.trips.length > 6 && <li>+{loc.trips.length - 6} more</li>}
                    </ul>
                    <button
                      type="button"
                      className="mt-1 text-xs underline"
                      onClick={() => setConditionsFor({ label: loc.name, query: { locationId: loc.locationId } })}
                    >
                      Today's conditions here
                    </button>
                  </Popup>
                </Marker>
              ))}

              {nearest?.items.map((n) => (
                <CircleMarker
                  key={n.id}
                  center={[n.latitude, n.longitude]}
                  radius={9}
                  pathOptions={{ color: '#2563eb', weight: 2, fillOpacity: 0.35 }}
                  eventHandlers={{ click: () => setConditionsFor({ label: n.name, query: { locationId: n.id } }) }}
                />
              ))}
            </MapContainer>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={nearestFromGps}><LocateFixed className="size-4" /> Nearest to me</Button>
            <Button variant="outline" onClick={nearestFromCentre}><Crosshair className="size-4" /> Nearest to map centre</Button>
          </div>
          {loadError && <p className="text-sm text-destructive">{loadError}</p>}
          {!loadError && trips.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Trips with a location appear here as pins. Tap anywhere on the map to see conditions there.
            </p>
          )}
        </div>

        <div className="space-y-4">
          {(nearest || nearestMessage) && (
            <Card>
              <CardContent className="space-y-2">
                <strong className="text-sm">Nearest spots</strong>
                {nearestMessage && <p className="text-sm text-muted-foreground">{nearestMessage}</p>}
                <ol className="m-0 list-decimal space-y-1 pl-5 text-sm">
                  {nearest?.items.map((n) => (
                    <li key={n.id}>
                      <button
                        type="button"
                        className="text-left hover:underline"
                        onClick={() => {
                          map?.flyTo([n.latitude, n.longitude], 13, { duration: 0.6 });
                          setConditionsFor({ label: n.name, query: { locationId: n.id } });
                        }}
                      >
                        {n.name}
                      </button>{' '}
                      <span className="text-muted-foreground">
                        {n.distanceKm < 1 ? `${Math.round(n.distanceKm * 1000)} m` : `${n.distanceKm.toFixed(1)} km`}
                        {n.isOwn ? ' · yours' : ' · public'}
                      </span>
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          )}

          {conditionsFor ? (
            <ConditionsPanel query={conditionsFor.query} title={`Today at ${conditionsFor.label}`} />
          ) : (
            <p className="text-sm text-muted-foreground">Tap a pin, a nearby spot, or anywhere on the map to see today's weather, moon and tides.</p>
          )}
        </div>
      </div>
    </div>
  );
}
