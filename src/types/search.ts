import type { PagedResult } from './catch';
import type { Trip } from './trip';

export interface SearchUserResult {
  id: string;
  userName: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  isFollowedByCurrentUser: boolean;
}

export interface SearchResults {
  users: PagedResult<SearchUserResult>;
  trips: PagedResult<Trip>;
}

export type SearchScope = 'all' | 'users' | 'trips';
