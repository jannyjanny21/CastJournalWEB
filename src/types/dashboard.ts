export interface BestCatch {
  catchId: string;
  tripId: string;
  speciesName: string;
  value: number;
  tripDate: string;
}

export interface DashboardSummary {
  tripCount: number;
  publishedTripCount: number;
  catchCount: number;
  speciesCount: number;
  tripsThisMonth: number;
  catchesThisMonth: number;
  lastTripDate: string | null;
  heaviestCatch: BestCatch | null;
  longestCatch: BestCatch | null;
  topSpecies: { speciesName: string; count: number }[];
}

export type LeaderboardMetric = 'catches' | 'heaviest' | 'longest';
export type LeaderboardPeriod = 'week' | 'month' | 'year' | 'all';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string | null;
  fullName: string | null;
  avatarUrl: string | null;
  value: number;
  catchId: string | null;
  tripId: string | null;
  speciesName: string | null;
}

export interface Leaderboard {
  metric: LeaderboardMetric;
  period: LeaderboardPeriod;
  unit: 'catches' | 'kg' | 'cm';
  from: string | null;
  to: string;
  totalAnglers: number;
  entries: LeaderboardEntry[];
  me: LeaderboardEntry | null;
}
