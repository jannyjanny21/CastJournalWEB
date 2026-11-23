import { api } from './client';

export type CategoryType = 'FishingMethod' | 'GearType' | 'Bait';

export interface ContentCategory {
  id: string;
  name: string;
  description: string | null;
  type: CategoryType;
  isActive: boolean;
}

export interface ContentCategoryPayload {
  name: string;
  description?: string | null;
}

/** The administrator-maintained values anglers pick from for gear, bait and method (UC-25). */
export const contentCategoriesApi = {
  getAll: (type?: CategoryType, includeInactive = false) => {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (includeInactive) params.set('includeInactive', 'true');
    const qs = params.toString();
    return api.get<ContentCategory[]>(`/contentcategories${qs ? `?${qs}` : ''}`);
  },

  // Admin only (F-25)
  create: (type: CategoryType, payload: ContentCategoryPayload) =>
    api.post<ContentCategory>('/contentcategories', { ...payload, type }),
  update: (id: string, payload: Partial<ContentCategoryPayload> & { isActive?: boolean }) =>
    api.put<ContentCategory>(`/contentcategories/${id}`, payload),
};
