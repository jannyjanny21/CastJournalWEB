import { api } from './client';
import type { Conditions } from '../types/conditions';

export type ConditionsQuery =
  | { lat: number; lng: number; date?: string; time?: string | null }
  | { locationId: string; date?: string; time?: string | null };

/** Weather, moon and estimated tides for a point or one of your/public locations. */
export const environmentApi = {
  get: (query: ConditionsQuery) => {
    const params = new URLSearchParams();
    if ('locationId' in query) params.set('locationId', query.locationId);
    else {
      params.set('lat', String(query.lat));
      params.set('lng', String(query.lng));
    }
    if (query.date) params.set('date', query.date);
    if (query.time) params.set('time', query.time.length === 5 ? `${query.time}:00` : query.time);
    return api.get<Conditions>(`/environment?${params.toString()}`);
  },
};
