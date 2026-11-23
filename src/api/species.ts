import { api } from './client';
import type { Species, SpeciesRequestPayload } from '../types/species';

export const speciesApi = {
  /** Approved species — the list anglers pick from. */
  getAll: () => api.get<Species[]>('/species'),
  /** Ask an administrator to add a missing species (FR-42, UC-32). */
  request: (payload: SpeciesRequestPayload) => api.post<Species>('/species/requests', payload),
  /** Your own requests with their status and any rejection reason. */
  getMyRequests: () => api.get<Species[]>('/species/requests/mine'),
};
