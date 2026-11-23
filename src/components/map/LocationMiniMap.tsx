import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { TILE_ATTRIBUTION, TILE_URL } from './leaflet';

/** Read-only map of one spot, e.g. a trip's location when it may be shown. */
export function LocationMiniMap({ lat, lng, height = 180 }: { lat: number; lng: number; height?: number }) {
  return (
    <div className="isolate overflow-hidden rounded-lg border border-border" style={{ height }}>
      <MapContainer
        center={[lat, lng]}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        dragging={false}
        doubleClickZoom={false}
        zoomControl={false}
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <Marker position={[lat, lng]} />
      </MapContainer>
    </div>
  );
}
