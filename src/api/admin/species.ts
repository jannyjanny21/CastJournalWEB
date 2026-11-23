import { api } from '../client';
import type { Species } from '../../types/species';

export interface SpeciesPayload {
  commonName: string;
  scientificName?: string;
  category?: string;
  description?: string;
  averageSize?: string;
  imageUrl?: string;
}

export const adminSpeciesApi = {
  create: (payload: SpeciesPayload) => api.post<Species>('/species', payload),
  update: (id: string, payload: SpeciesPayload) => api.put<Species>(`/species/${id}`, payload),
  remove: (id: string) => api.delete<void>(`/species/${id}`),

  /** Pending species requests, oldest first (FR-42). */
  getPendingRequests: () => api.get<Species[]>('/species/requests'),
  /** Approve, optionally correcting the details first. */
  approve: (id: string, corrections?: Partial<SpeciesPayload>) =>
    api.post<Species>(`/species/${id}/approve`, corrections ?? {}),
  reject: (id: string, reason: string) => api.post<Species>(`/species/${id}/reject`, { reason }),
};
