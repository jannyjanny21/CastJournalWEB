import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

// Leaflet's default icon prefixes its image URLs with a folder path it detects from the CSS,
// which breaks bundled (and inlined) images. Use an explicit icon for every marker instead.
export const DEFAULT_MARKER_ICON = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41],
});
L.Marker.prototype.options.icon = DEFAULT_MARKER_ICON;

/** Same pin, greyed out (see .cj-marker-muted in index.css): a saved spot with no trips yet. */
export const MUTED_MARKER_ICON = L.icon({
  ...DEFAULT_MARKER_ICON.options,
  iconUrl: markerIcon,
  className: 'cj-marker-muted',
});

/**
 * Raster tiles. OpenStreetMap's own servers are fine for development and a capstone demo, but their
 * usage policy asks heavy users to move elsewhere: set VITE_MAP_TILE_URL (and attribution) to another
 * provider before real traffic (F-01 note).
 */
export const TILE_URL: string =
  import.meta.env.VITE_MAP_TILE_URL ?? 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const TILE_ATTRIBUTION: string =
  import.meta.env.VITE_MAP_TILE_ATTRIBUTION ??
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Map view when nothing is known yet: the Philippines. */
export const DEFAULT_CENTER: [number, number] = [12.8797, 121.774];
export const DEFAULT_ZOOM = 6;

/** Old quick-add saved locations at 0,0, meaning "no position set". */
export function hasPosition(lat: number, lng: number): boolean {
  return !(lat === 0 && lng === 0);
}
