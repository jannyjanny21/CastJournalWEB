import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Trophy } from 'lucide-react';
import { dashboardApi } from '../../api/dashboard';
import type { Leaderboard, LeaderboardEntry, LeaderboardMetric, LeaderboardPeriod } from '../../types/dashboard';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { useAuth } from '../../context/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const METRICS: { value: LeaderboardMetric; label: string }[] = [
  { value: 'catches', label: 'Most catches' },
  { value: 'heaviest', label: 'Heaviest' },
  { value: 'longest', label: 'Longest' },
];
const PERIODS: { value: LeaderboardPeriod; label: string }[] = [
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'year', label: 'This year' },
  { value: 'all', label: 'All time' },
];

function formatValue(value: number, unit: Leaderboard['unit']) {
  if (unit === 'catches') return `${value} ${value === 1 ? 'catch' : 'catches'}`;
  return `${Number(value.toFixed(2))} ${unit}`;
}

const medal = (rank: number) => (rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null);

/** Leaderboards by most catches, heaviest and longest catch for a chosen period — published trips only (F-14). */
export function Leaderboards() {
  const { user } = useAuth();
  const [metric, setMetric] = useState<LeaderboardMetric>('catches');
  const [period, setPeriod] = useState<LeaderboardPeriod>('month');
  const [state, setState] = useState<{ key: string; data?: Leaderboard; error?: boolean } | null>(null);
  const key = `${metric}|${period}`;

  useEffect(() => {
    let cancelled = false;
    dashboardApi
      .getLeaderboard(metric, period)
      .then((data) => { if (!cancelled) setState({ key: `${metric}|${period}`, data }); })
      .catch(() => { if (!cancelled) setState({ key: `${metric}|${period}`, error: true }); });
    return () => { cancelled = true; };
  }, [metric, period]);

  const current = state?.key === key ? state : null;
  const board = current?.data;
  const meInList = !!board?.entries.some((e) => e.userId === user?.id);

  const row = (e: LeaderboardEntry, highlight: boolean) => (
    <li
      key={e.userId}
      className={cn('flex items-center gap-3 rounded-md px-2 py-1.5', highlight && 'bg-primary/10')}
    >
      <span className="w-7 shrink-0 text-center font-mono text-sm">{medal(e.rank) ?? `#${e.rank}`}</span>
      {e.avatarUrl ? (
        <img src={resolveMediaUrl(e.avatarUrl)} alt="" className="size-7 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="size-7 shrink-0 rounded-full bg-muted" />
      )}
      <Link to={`/anglers/${e.userId}`} className="min-w-0 flex-1 truncate text-sm no-underline hover:underline">
        {e.fullName || e.userName}
        {highlight && <span className="text-muted-foreground"> (you)</span>}
      </Link>
      <span className="shrink-0 text-right font-mono text-sm">
        {e.tripId ? (
          <Link to={`/trips/${e.tripId}`} className="no-underline hover:underline">{formatValue(e.value, board!.unit)}</Link>
        ) : (
          formatValue(e.value, board!.unit)
        )}
        {e.speciesName && <span className="block text-xs text-muted-foreground">{e.speciesName}</span>}
      </span>
    </li>
  );

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 flex items-center gap-2 font-heading text-lg"><Trophy className="size-5 text-[color:var(--color-brass)]" /> Leaderboards</h2>
          <select
            aria-label="Period"
            value={period}
            onChange={(e) => setPeriod(e.target.value as LeaderboardPeriod)}
            className="rounded-md border border-border bg-transparent px-2 py-1 text-sm"
          >
            {PERIODS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>

        <div className="flex gap-1 rounded-lg border border-border p-1" role="tablist">
          {METRICS.map((m) => (
            <button
              key={m.value}
              type="button"
              role="tab"
              aria-selected={metric === m.value}
              onClick={() => setMetric(m.value)}
              className={cn(
                'flex-1 rounded-md px-2 py-1 text-sm whitespace-nowrap',
                metric === m.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {!current && <p className="m-0 text-sm text-muted-foreground">Loading…</p>}
        {current?.error && <p className="m-0 text-sm text-destructive">Couldn't load the leaderboard.</p>}
        {board && board.entries.length === 0 && (
          <p className="m-0 text-sm text-muted-foreground">
            No published catches {period === 'all' ? 'yet' : 'in this period'}. Publish a trip to get on the board.
          </p>
        )}

        {board && board.entries.length > 0 && (
          <>
            <ol className="m-0 list-none space-y-0.5 p-0">
              {board.entries.map((e) => row(e, e.userId === user?.id))}
            </ol>
            {board.me && !meInList && (
              <ol className="m-0 list-none border-t border-dashed border-border p-0 pt-1">{row(board.me, true)}</ol>
            )}
            <p className="m-0 text-xs text-muted-foreground">
              {board.me
                ? `You're #${board.me.rank} of ${board.totalAnglers} ${board.totalAnglers === 1 ? 'angler' : 'anglers'}.`
                : 'Only published trips count. Publish a trip to appear here.'}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
