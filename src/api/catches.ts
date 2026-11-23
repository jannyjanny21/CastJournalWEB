import { api, uploadFile } from './client';
import type { Catch, CreateCatchPayload, CatchFilter, PagedResult, CatchMedia } from '../types/catch';

function toQueryString(filter: object): string {
  const params = new URLSearchParams();
  Object.entries(filter as Record<string, unknown>).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      params.append(key, String(value));
    }
  });
  return params.toString();
}

/**
 * Individual catches. Creating a catch, the feed, likes and comments all go
 * through trips now (see api/trips.ts and api/comments.ts).
 */
export const catchesApi = {
  search: (filter: CatchFilter) =>
    api.get<PagedResult<Catch>>(`/catches/search?${toQueryString(filter)}`),

  getById: (id: string) => api.get<Catch>(`/catches/${id}`),
  update: (id: string, payload: CreateCatchPayload) => api.put<void>(`/catches/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/catches/${id}`),

  /** clientId: made on the device, so a retried upload doesn't add the file twice (F-13). */
  uploadMedia: (catchId: string, file: Blob, clientId?: string, fileName?: string) => {
    const formData = new FormData();
    formData.append('catchId', catchId);
    formData.append('file', file, fileName ?? (file instanceof File ? file.name : 'upload'));
    if (clientId) formData.append('clientId', clientId);
    return uploadFile<CatchMedia>('/media/upload', formData);
  },

  getMedia: (catchId: string) => api.get<CatchMedia[]>(`/media/catch/${catchId}`),
  deleteMedia: (mediaId: string) => api.delete<void>(`/media/${mediaId}`),
  /** Every media ID of the catch, in the new display order; the first is the cover (FR-10). */
  reorderMedia: (catchId: string, mediaIds: string[]) =>
    api.patch<CatchMedia[]>('/media/reorder', { catchId, mediaIds }),
};
