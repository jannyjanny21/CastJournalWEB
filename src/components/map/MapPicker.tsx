import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { Marker as LeafletMarker } from 'leaflet';
import { LocateFixed } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DEFAULT_CENTER, DEFAULT_ZOOM, TILE_ATTRIBUTION, TILE_URL, hasPosition } from './leaflet';

export interface LatLng {
  lat: number;
  lng: number;
}

/** Leaflet measures its container once; inside dialogs and collapsible forms it must measure again. */
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    const id = window.setTimeout(() => map.invalidateSize(), 150);
    return () => window.clearTimeout(id);
  }, [map]);
  return null;
}

function ClickToPlace({ onPick }: { onPick: (p: LatLng) => void }) {
  // wrap(): the map repeats the world sideways, so a tap can be at lng 481; bring it back into -180..180.
  useMapEvents({ click: (e) => { const p = e.latlng.wrap(); onPick({ lat: p.lat, lng: p.lng }); } });
  return null;
}

function FlyTo({ target }: { target: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [map, target]);
  return null;
}

const round6 = (n: number) => Math.round(n * 1e6) / 1e6;

/**
 * Place or adjust a fishing location (FR-7, FR-15): tap the map, drag the pin, or use the device's GPS.
 * If location permission is refused, tapping the map still works.
 */
export function MapPicker({
  value,
  onChange,
  height = 260,
}: {
  value: LatLng | null;
  onChange: (p: LatLng) => void;
  height?: number;
}) {
  const markerRef = useRef<LeafletMarker | null>(null);
  const [accuracy, setAccuracy] = useState<{ center: LatLng; meters: number } | null>(null);
  const [flyTarget, setFlyTarget] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const position = value && hasPosition(value.lat, value.lng) ? value : null;
  // Start centred on the pin if there is one; MapContainer ignores later changes to `center`.
  const [initialCenter] = useState<[number, number]>(() => (position ? [position.lat, position.lng] : DEFAULT_CENTER));
  const initialZoom = position ? 14 : DEFAULT_ZOOM;

  const pick = (p: LatLng) => onChange({ lat: round6(p.lat), lng: round6(p.lng) });

  const markerHandlers = useMemo(
    () => ({
      dragend() {
        const m = markerRef.current;
        if (m) {
          const ll = m.getLatLng().wrap();
          pick({ lat: ll.lat, lng: ll.lng });
        }
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onChange],
  );

  const useMyLocation = () => {
    if (!('geolocation' in navigator)) {
      setGpsError('This browser has no location access. Tap the map to place the pin instead.');
      return;
    }
    setLocating(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const p = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        pick(p);
        setAccuracy({ center: p, meters: pos.coords.accuracy });
        setFlyTarget(p);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was refused. Tap the map to place the pin instead.'
            : "Couldn't get your location. Tap the map to place the pin instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  };

  return (
    <div className="space-y-2">
      <div className="isolate overflow-hidden rounded-lg border border-border" style={{ height }}>
        <MapContainer center={initialCenter} zoom={initialZoom} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
          <InvalidateSize />
          <ClickToPlace onPick={pick} />
          <FlyTo target={flyTarget} />
          {accuracy && accuracy.meters < 5000 && (
            <Circle
              center={[accuracy.center.lat, accuracy.center.lng]}
              radius={accuracy.meters}
              pathOptions={{ weight: 1, fillOpacity: 0.12 }}
            />
          )}
          {position && (
            <Marker
              position={[position.lat, position.lng]}
              draggable
              eventHandlers={markerHandlers}
              ref={markerRef}
            />
          )}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button type="button" variant="outline" size="sm" onClick={useMyLocation} disabled={locating}>
          <LocateFixed className="size-4" />
          {locating ? 'Finding you…' : 'Use my location'}
        </Button>
        <span className="font-mono text-xs text-muted-foreground">
          {position
            ? `${position.lat.toFixed(5)}, ${position.lng.toFixed(5)}${accuracy ? ` (±${Math.round(accuracy.meters)} m)` : ''}`
            : 'Tap the map to place a pin'}
        </span>
      </div>
      {gpsError && <p className="text-xs text-destructive">{gpsError}</p>}
    </div>
  );
}
