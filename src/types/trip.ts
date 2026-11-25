import type { CreateLocationPayload } from './location';
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
  /** Null when hidden from this viewer (FR-45). */
  locationLatitude: number | null;
  locationLongitude: number | null;
  locationIsPublic: boolean;
  /** The trip has a private location this viewer may not see. */
  locationHidden: boolean;
  /** The angler removed this spot from their list since; the trip still shows it. */
  locationDeleted: boolean;
  /** Owner chose to show private locations when publishing. */
  disclosesPrivateLocations: boolean;
  /** An administrator removed it from the community after a report; it can't be republished (F-18). */
  removedFromCommunity: boolean;
  moderationReason: string | null;
  title: string | null;
  tripDate: string;
  startTime: string | null;
  endTime: string | null;
  /** Last day of a multi-day trip; null for a single session. */
  endDate: string | null;
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
  /** Multi-day trips: the last day (up to 7 days). Null for a single session or while still fishing. */
  endDate?: string | null;
  locationId: string | null;
  notes: string | null;
  weatherConditions: string | null;
  /** Logging a trip that's still going (started within the last 7 days), so there's no end time yet. */
  stillFishing?: boolean;
  /**
   * New trips only: a spot made on the device while offline, used when locationId is null.
   * The server saves the spot and the trip together, so a retried upload never makes it twice.
   */
  newLocation?: CreateLocationPayload | null;
}

export interface CreateTripPayload extends UpdateTripPayload {
  catches: CreateCatchPayload[];
  /** Made on the device; a retried upload with the same ID returns the trip already saved (F-13). */
  clientId?: string;
}

export interface TripFilter {
  startDate?: string;
  endDate?: string;
  /** My Trips tab: only published or only private trips. */
  visibility?: 'published' | 'private';
  page?: number;
  pageSize?: number;
}

export interface TripFeedFilter {
  userId?: string;
  followingOnly?: boolean;
  page?: number;
  pageSize?: number;
}

/** GET /api/trips/{id}/publish-preview: what others will see (FR-45). */
export interface PublishPreview {
  tripId: string;
  isPublic: boolean;
  title: string | null;
  tripDate: string;
  catchCount: number;
  photoCount: number;
  videoCount: number;
  hasNotes: boolean;
  hasConditions: boolean;
  visible: string[];
  privateLocations: { id: string; name: string }[];
}

/** GET /api/trips/deleted: a trip in Recently deleted (B-24). */
export interface DeletedTrip {
  id: string;
  title: string | null;
  tripDate: string;
  endDate: string | null;
  locationName: string | null;
  catchCount: number;
  wasPublic: boolean;
  deletedAt: string;
  restorableUntil: string;
}

/** GET /api/trips/counts — numbers on the My Trips tabs. */
export interface TripCounts {
  all: number;
  published: number;
  private: number;
}
