/** Mirrors the API's EnvironmentDto (GET /api/environment). Times are local "HH:mm". */
export interface Weather {
  description: string;
  weatherCode: number | null;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  humidityPercent: number | null;
  precipitationMm: number | null;
  precipitationProbabilityPercent: number | null;
  windSpeedKmh: number | null;
  windDirectionDegrees: number | null;
  windDirection: string | null;
  cloudCoverPercent: number | null;
  pressureHpa: number | null;
  pressureTrend: 'Rising' | 'Falling' | 'Steady' | null;
}

export interface Moon {
  phaseName: string;
  phase: number;
  illuminationPercent: number;
  moonrise: string | null;
  moonset: string | null;
  alwaysUp: boolean;
  alwaysDown: boolean;
}

export interface TideEvent { type: 'High' | 'Low'; time: string; heightM: number }
export interface TidePoint { time: string; heightM: number }

export interface Tide {
  available: boolean;
  unavailableReason: string | null;
  isEstimate: boolean;
  events: TideEvent[];
  hourly: TidePoint[];
  seaSurfaceTemperatureC: number | null;
  waveHeightM: number | null;
}

export interface Conditions {
  latitude: number;
  longitude: number;
  date: string;
  localTime: string | null;
  timezone: string | null;
  weather: Weather | null;
  sun: { sunrise: string | null; sunset: string | null } | null;
  moon: Moon;
  tide: Tide;
  notes: string[];
  attribution: string;
}

export interface NearbyLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  waterType: string;
  isPublic: boolean;
  isOwn: boolean;
  distanceKm: number;
}

export interface TripMapLocation {
  locationId: string;
  name: string;
  latitude: number;
  longitude: number;
  waterType: string;
  trips: { id: string; title: string | null; tripDate: string; catchCount: number; species: string[] }[];
}
