import type { Catch, CreateCatchPayload } from './catch';

/**
 * A fishing trip — the post. Holds its catches; likes and comments attach to the trip.
 * Dates come from the API as "YYYY-MM-DD" and times as "HH:mm:ss".
 */
export interface Trip {
  id: string;
  userId: string;
  userFullName: string | null;
  userAvatarUrl: string | null;
  locationId: string | null;
  locationName: string | null;
  title: string | null;
  tripDate: string;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  weatherConditions: string | null;
  lunarConditions: string | null;
  tidalConditions: string | null;
  isPublic: boolean;
  publishedAt: string | null;
  createdAt: string;
  catchCount: number;
  likeCount: number;
  commentCount: number;
  isLikedByCurrentUser: boolean;
  catches: Catch[];
}

export interface UpdateTripPayload {
  title: string | null;
  tripDate: string;
  startTime: string | null;
  endTime: string | null;
  locationId: string | null;
  notes: string | null;
  weatherConditions: string | null;
  isPublic: boolean;
  /** Logging a session that's still going (today only), so there's no end time yet. */
  stillFishing?: boolean;
}

export interface CreateTripPayload extends UpdateTripPayload {
  catches: CreateCatchPayload[];
}

export interface TripFilter {
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface TripFeedFilter {
  userId?: string;
  followingOnly?: boolean;
  page?: number;
  pageSize?: number;
}
