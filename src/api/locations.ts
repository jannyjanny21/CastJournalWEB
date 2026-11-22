import type { PagedResult } from '../types/catch';
import { api } from './client';
import type { Location, CreateLocationPayload } from '../types/location';

export const locationsApi = {
  getMine: () => api.get<Location[]>('/locations'),
  getPublic: (page = 1, pageSize = 20) =>
    api.get<PagedResult<Location>>(`/locations/public?page=${page}&pageSize=${pageSize}`),
  create: (payload: CreateLocationPayload) => api.post<Location>('/locations', payload),
  update: (id: string, payload: CreateLocationPayload) => api.put<Location>(`/locations/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/locations/${id}`),
};
