import { api } from './client';
import type { Catch, CreateCatchPayload, PagedResult } from '../types/catch';
import type { CreateTripPayload, DeletedTrip, PublishPreview, Trip, TripFeedFilter, TripFilter, UpdateTripPayload } from '../types/trip';
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

  /** What others will see if published, and which private spots the trip uses (FR-45). */
  getPublishPreview: (id: string) => api.get<PublishPreview>(`/trips/${id}/publish-preview`),
  /** Upload now / later (FR-43). disclosePrivateLocations = explicit consent to show private spots. */
  publish: (id: string, disclosePrivateLocations: boolean) =>
    api.post<Trip>(`/trips/${id}/publish`, { disclosePrivateLocations }),
  /** Withdraw a published trip (FR-45). */
  unpublish: (id: string) => api.post<Trip>(`/trips/${id}/unpublish`),

  /** Recently deleted (B-24): restorable for 30 days. */
  getDeleted: () => api.get<DeletedTrip[]>('/trips/deleted'),
  /** Brings a deleted trip back with its catches, as a private trip. */
  restore: (id: string) => api.post<Trip>(`/trips/${id}/restore`),
  create: (payload: CreateTripPayload) => api.post<Trip>('/trips', payload),
  update: (id: string, payload: UpdateTripPayload) => api.put<Trip>(`/trips/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/trips/${id}`),

  addCatch: (tripId: string, payload: CreateCatchPayload) =>
    api.post<Catch>(`/trips/${tripId}/catches`, payload),

  like: (tripId: string) => api.post<void>(`/trips/${tripId}/like`),
  unlike: (tripId: string) => api.delete<void>(`/trips/${tripId}/like`),
};
