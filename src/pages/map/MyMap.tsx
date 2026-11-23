import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, Tooltip, useMap, useMapEvents } from 'react-leaflet';
import { LatLngBounds, type Map as LeafletMap } from 'leaflet';
import { LocateFixed, Crosshair } from 'lucide-react';
import { tripsApi } from '../../api/trips';
import { locationsApi } from '../../api/locations';
import type { NearbyLocation, TripMapLocation } from '../../types/conditions';
import type { ConditionsQuery } from '../../api/environment';
import { DEFAULT_CENTER, DEFAULT_ZOOM, MUTED_MARKER_ICON, TILE_ATTRIBUTION, TILE_URL, hasPosition } from '../../components/map/leaflet';
import type { Location } from '../../types/location';
import DEFAULT_PIN from 'leaflet/dist/images/marker-icon.png';
import { formatTripDates } from '../../utils/trip';
import { PageHeader } from '../../components/PageHeader';
import { ConditionsPanel } from '../../components/ConditionsPanel';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

/** Zooms to fit the pins once they load. */
function FitToTrips({ points }: { points: { latitude: number; longitude: number }[] }) {
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
  const [myLocations, setMyLocations] = useState<Location[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [nearest, setNearest] = useState<{ from: [number, number]; items: NearbyLocation[] } | null>(null);
  const [nearestMessage, setNearestMessage] = useState<string | null>(null);
  const [conditionsFor, setConditionsFor] = useState<{ label: string; query: ConditionsQuery } | null>(null);

  useEffect(() => {
    tripsApi.getMap().then(setTrips).catch(() => setLoadError('Could not load your trips.'));
    locationsApi.getMine().then(setMyLocations).catch(() => { /* trip pins still show */ });
  }, []);

  // Saved spots you haven't logged a trip at yet: shown as grey pins so every spot is on the map.
  const tripLocationIds = new Set(trips.map((t) => t.locationId));
  const emptySpots = myLocations.filter((l) => !tripLocationIds.has(l.id) && hasPosition(l.latitude, l.longitude));
  const fitPoints = trips.length > 0 ? trips : emptySpots;

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
              <FitToTrips points={fitPoints} />
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
                          <Link to={`/trips/${t.id}`}>{formatTripDates(t)} · {tripLabel(t)}</Link>
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

              {emptySpots.map((l) => (
                <Marker key={l.id} position={[l.latitude, l.longitude]} icon={MUTED_MARKER_ICON}>
                  <Tooltip direction="top" offset={[0, -36]}>{l.name}</Tooltip>
                  <Popup>
                    <strong>{l.name}</strong>
                    <p className="m-0 mt-1 text-xs">No trips logged here yet.</p>
                    <div className="mt-1 flex flex-col items-start gap-0.5">
                      <button
                        type="button"
                        className="text-xs underline"
                        onClick={() => setConditionsFor({ label: l.name, query: { locationId: l.id } })}
                      >
                        Today's conditions here
                      </button>
                      <Link to="/trips/new" className="text-xs">Log a trip</Link>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {/* Nearest-spot results: a numbered ring matching the list beside the map. */}
              {nearest?.items.map((n, i) => (
                <CircleMarker
                  key={n.id}
                  center={[n.latitude, n.longitude]}
                  radius={12}
                  pathOptions={{ color: '#2563eb', weight: 2.5, fillOpacity: 0.15 }}
                  eventHandlers={{ click: () => setConditionsFor({ label: n.name, query: { locationId: n.id } }) }}
                >
                  <Tooltip direction="right" offset={[12, 0]} permanent className="cj-nearest-label">
                    {i + 1}. {n.name}
                  </Tooltip>
                </CircleMarker>
              ))}
            </MapContainer>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={nearestFromGps}><LocateFixed className="size-4" /> Nearest to me</Button>
            <Button variant="outline" onClick={nearestFromCentre}><Crosshair className="size-4" /> Nearest to map centre</Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Map legend">
            <span className="flex items-center gap-1"><img src={DEFAULT_PIN} alt="" className="h-4" /> Spot with your trips</span>
            <span className="flex items-center gap-1"><img src={DEFAULT_PIN} alt="" className="h-4 opacity-80 grayscale" /> Saved spot, no trips yet</span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-3.5 rounded-full border-2 border-[#2563eb] bg-[#2563eb]/15" /> Nearest-spot result
            </span>
          </div>
          {loadError && <p className="text-sm text-destructive">{loadError}</p>}
          {!loadError && trips.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Trips appear here as pins at their location. Tap anywhere on the map to see conditions there.
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
