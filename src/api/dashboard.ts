import { api } from './client';
import type { DashboardSummary, Leaderboard, LeaderboardMetric, LeaderboardPeriod } from '../types/dashboard';

/** The viewer's local date (YYYY-MM-DD), so "this week/month" follows their calendar. */
function localToday(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Gamified dashboard (F-14). */
export const dashboardApi = {
  getSummary: () => api.get<DashboardSummary>(`/dashboard?today=${localToday()}`),
  /** Ranked from published trips only. */
  getLeaderboard: (metric: LeaderboardMetric, period: LeaderboardPeriod, top = 10) =>
    api.get<Leaderboard>(`/leaderboards?metric=${metric}&period=${period}&top=${top}&today=${localToday()}`),
};
