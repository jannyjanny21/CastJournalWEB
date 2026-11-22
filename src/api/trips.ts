import { api } from './client';
import type { Catch, CreateCatchPayload, PagedResult } from '../types/catch';
import type { CreateTripPayload, Trip, TripFeedFilter, TripFilter, UpdateTripPayload } from '../types/trip';
import type { TripMapLocation } from '../types/conditions';

function toQueryString(filter: object): string {
  const params = new URLSearchParams();
  Object.entries(filter as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  });
  return params.toString();
}

export const tripsApi = {
  getMine: (filter: TripFilter = {}) =>
    api.get<PagedResult<Trip>>(`/trips?${toQueryString(filter)}`),

  getFeed: (filter: TripFeedFilter = {}) =>
    api.get<PagedResult<Trip>>(`/trips/feed?${toQueryString(filter)}`),

  getById: (id: string) => api.get<Trip>(`/trips/${id}`),
  /** Your own trips grouped by location, with coordinates, for the map. */
  getMap: () => api.get<TripMapLocation[]>('/trips/map'),
  refreshConditions: (id: string) => api.post<Trip>(`/trips/${id}/conditions/refresh`),
  create: (payload: CreateTripPayload) => api.post<Trip>('/trips', payload),
  update: (id: string, payload: UpdateTripPayload) => api.put<Trip>(`/trips/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/trips/${id}`),

  addCatch: (tripId: string, payload: CreateCatchPayload) =>
    api.post<Catch>(`/trips/${tripId}/catches`, payload),

  like: (tripId: string) => api.post<void>(`/trips/${tripId}/like`),
  unlike: (tripId: string) => api.delete<void>(`/trips/${tripId}/like`),
};
