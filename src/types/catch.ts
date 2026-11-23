export interface CatchMedia {
  id: string;
  mediaUrl: string;
  fileName: string | null;
  mediaType: string;
  orderIndex: number;
}

export interface Catch {
  id: string;
  tripId: string;
  userId: string;
  userFullName: string | null;
  userAvatarUrl: string | null;
  speciesId: string;
  speciesName: string | null;
  locationId: string | null;
  locationName: string | null;
  locationIsPublic: boolean;
  /** This catch's private location is hidden from this viewer (FR-45). */
  locationHidden: boolean;
  catchDate: string;
  weight: number | null;
  length: number | null;
  gearUsed: string | null;
  baitUsed: string | null;
  fishingMethod: string | null;
  notes: string | null;
  /** Read-only: taken from the parent trip. */
  weatherConditions: string | null;
  /** Read-only: taken from the parent trip. */
  isPublic: boolean;
  createdAt: string;
  likeCount: number;
  commentCount: number;
  isLikedByCurrentUser: boolean;
  media: CatchMedia[];
}

export interface CreateCatchPayload {
  speciesId: string;
  locationId: string | null;
  catchDate: string;
  weight: number | null;
  length: number | null;
  gearUsed: string | null;
  baitUsed: string | null;
  fishingMethod: string | null;
  notes: string | null;
  /** Made on the device; a retried upload with the same ID doesn't create a duplicate (F-13). */
  clientId?: string;
}

export interface CatchFilter {
  speciesId?: string;
  locationId?: string;
  startDate?: string;
  endDate?: string;
  minWeight?: number;
  maxWeight?: number;
  searchTerm?: string;
  sortBy?: 'catchdate' | 'weight' | 'length';
  sortDescending?: boolean;
  page?: number;
  pageSize?: number;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
