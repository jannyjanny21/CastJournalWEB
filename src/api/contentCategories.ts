import { api } from './client';

export type CategoryType = 'FishingMethod' | 'GearType' | 'Bait';

export interface ContentCategory {
  id: string;
  name: string;
  description: string | null;
  type: CategoryType;
  isActive: boolean;
}

/** The administrator-maintained values anglers pick from for gear, bait and method (UC-25). */
export const contentCategoriesApi = {
  getAll: (type?: CategoryType) =>
    api.get<ContentCategory[]>(`/contentcategories${type ? `?type=${type}` : ''}`),
};
