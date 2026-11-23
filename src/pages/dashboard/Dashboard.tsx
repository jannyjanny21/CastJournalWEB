import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { dashboardApi } from '../../api/dashboard';
import type { BestCatch, DashboardSummary } from '../../types/dashboard';
import { useAuth } from '../../context/useAuth';
import { formatShortDate, formatTripDate } from '../../utils/trip';
import { CastDivider } from '../../components/CastDivider';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Leaderboards } from './Leaderboards';
import { WeatherCard } from './WeatherCard';

function StatTile({ value, label, sub }: { value: string | number; label: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="text-center font-mono">
        <div className="text-2xl font-bold break-words text-primary">{value}</div>
        <div className="text-sm text-muted-foreground">{label}</div>
        {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function BestTile({ title, best, unit }: { title: string; best: BestCatch | null; unit: string }) {
  return (
    <Card>
      <CardContent>
        <div className="text-sm text-muted-foreground">🏆 {title}</div>
        {best ? (
          <Link to={`/trips/${best.tripId}`} className="no-underline hover:underline">
            <strong>{best.speciesName}</strong>
            <div className="font-mono">{Number(best.value.toFixed(2))} {unit}</div>
            <div className="text-xs text-muted-foreground">{formatTripDate(best.tripDate)}</div>
          </Link>
        ) : (
          <div className="text-sm text-muted-foreground">Not recorded yet</div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * The gamified dashboard (F-14, F-24; Ch.4 Fig. 8): the angler's home screen after sign-in.
 * Their own statistics, the community leaderboards, and the weather for a chosen spot.
 */
export function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    dashboardApi
      .getSummary()
      .then((s) => { if (!cancelled) setSummary(s); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  const firstName = (user?.fullName || '').split(' ')[0];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="m-0 font-heading text-2xl">{firstName ? `Welcome back, ${firstName}` : 'Dashboard'}</h1>
        <Link to="/trips/new"><Button><Plus className="size-4" /> Log a trip</Button></Link>
      </div>
      <CastDivider />

      {error && <p className="text-sm text-destructive">Couldn't load your statistics.</p>}
      {!summary && !error && <p className="text-muted-foreground">Loading…</p>}

      {summary && (
        <>
          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatTile value={summary.tripCount} label="Trips" sub={`${summary.publishedTripCount} published`} />
            <StatTile value={summary.catchCount} label="Catches" sub={`${summary.catchesThisMonth} this month`} />
            <StatTile value={summary.speciesCount} label="Species" sub={summary.topSpecies[0] ? `Most: ${summary.topSpecies[0].speciesName}` : undefined} />
            <StatTile
              value={summary.lastTripDate ? formatShortDate(summary.lastTripDate) : '—'}
              label="Last trip"
              sub={`${summary.tripsThisMonth} this month`}
            />
          </div>
          <div className="mb-6 grid grid-cols-2 gap-4">
            <BestTile title="Heaviest catch" best={summary.heaviestCatch} unit="kg" />
            <BestTile title="Longest catch" best={summary.longestCatch} unit="cm" />
          </div>
          {summary.tripCount === 0 && (
            <p className="mb-6 text-sm text-muted-foreground">
              Log your first trip to start filling in your stats. <Link to="/trips/new" className="underline">Log a trip</Link>
            </p>
          )}
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Leaderboards />
        <WeatherCard />
      </div>

      <p className="mt-6 text-sm text-muted-foreground">
        More detail on <Link to="/analytics" className="underline">My Stats</Link>, or see what others caught in the{' '}
        <Link to="/feed" className="underline">Feed</Link>.
      </p>
    </div>
  );
}
