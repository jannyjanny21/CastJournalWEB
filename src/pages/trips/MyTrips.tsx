import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Lock, Trash2 } from 'lucide-react';
import { tripsApi } from '../../api/trips';
import type { PagedResult } from '../../types/catch';
import type { Trip, TripCounts } from '../../types/trip';
import { PageHeader } from '../../components/PageHeader';
import { CatchRowSkeleton } from '../../components/CatchRowSkeleton';
import { PendingTrips } from '../../components/PendingTrips';
import { useOutbox } from '../../offline/outbox';
import { TripOwnerMenu } from '../../components/TripOwnerMenu';
import { formatTripDates, timeRange, tripHeading } from '../../utils/trip';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Tab = 'all' | 'published' | 'private';
const TABS: { id: Tab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'private', label: 'Private' },
];

export function MyTrips() {
  const [result, setResult] = useState<PagedResult<Trip> | null>(null);
  const [counts, setCounts] = useState<TripCounts | null>(null);
  const [tab, setTab] = useState<Tab>('all');
  // Bumped after a change from a row's ⋯ menu, so the list and the tab counts reload.
  const [version, setVersion] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Reload the list when a trip logged offline finishes uploading.
  const { uploadedVersion } = useOutbox();

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const dates = { startDate: startDate || undefined, endDate: endDate || undefined };
        const [res, c] = await Promise.all([
          tripsApi.getMine({ ...dates, visibility: tab === 'all' ? undefined : tab, page, pageSize: 10 }),
          tripsApi.getCounts(dates).catch(() => null),
        ]);
        if (!cancelled) {
          setResult(res);
          setCounts(c);
        }
      } catch {
        if (!cancelled) setError('Could not load your trips.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [startDate, endDate, page, tab, version, uploadedVersion]);

  const filtered = !!(startDate || endDate);

  return (
    <div>
      <PageHeader
        title="My Trips"
        action={<Link to="/trips/new"><Button>+ Log a trip</Button></Link>}
      >
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            From
            <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setPage(1); }} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            To
            <Input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setPage(1); }} />
          </label>
          {filtered && (
            <Button variant="ghost" onClick={() => { setStartDate(''); setEndDate(''); setPage(1); }}>
              Clear
            </Button>
          )}
          <Link to="/trips/deleted" className="ml-auto flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <Trash2 className="size-4" /> Recently deleted
          </Link>
        </div>

        <div role="tablist" aria-label="Filter trips by visibility" className="mt-4 flex gap-1 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => { setTab(t.id); setPage(1); }}
              className={cn(
                '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors',
                tab === t.id
                  ? 'border-[color:var(--color-brass)] font-medium text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground',
              )}
            >
              {t.id === 'published' && <Globe className="size-3.5" />}
              {t.id === 'private' && <Lock className="size-3.5" />}
              {t.label}
              {counts && (
                <span className="rounded-full bg-muted px-1.5 text-xs tabular-nums text-muted-foreground">
                  {counts[t.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </PageHeader>

      <div className="pt-6">
        <PendingTrips />
        {isLoading && (
          <div className="flex flex-col gap-3">
            <CatchRowSkeleton />
            <CatchRowSkeleton />
            <CatchRowSkeleton />
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!isLoading && result && result.items.length === 0 && (
          <Card>
            <CardContent className="text-center text-muted-foreground">
              {filtered ? (
                <p>No {tab === 'all' ? '' : `${tab} `}trips in that date range.</p>
              ) : tab === 'published' ? (
                <p>None of your trips are published yet. Open a trip and choose <strong>Publish…</strong> to share it with the community.</p>
              ) : tab === 'private' ? (
                <p>All your trips are published.</p>
              ) : (
                <>
                  <p>You haven't logged a trip yet.</p>
                  <Link to="/trips/new"><Button>Log your first trip</Button></Link>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {!isLoading && (
          <div className="flex flex-col gap-3">
            {result?.items.map((t) => {
              const times = timeRange(t);
              return (
                <Card key={t.id} interactive className="relative">
                  <CardContent className="flex flex-row items-center justify-between gap-3">
                    {/* The whole row opens the trip; the ⋯ menu sits above the link. */}
                    <Link to={`/trips/${t.id}`} className="min-w-0 flex-1 text-inherit no-underline after:absolute after:inset-0">
                      <strong className="block truncate">{tripHeading(t)}</strong>
                      <div className="font-mono text-sm text-muted-foreground">
                        {[formatTripDates(t), times, t.locationName ?? 'No location'].filter(Boolean).join(' · ')} · {t.catchCount}{' '}
                        {t.catchCount === 1 ? 'catch' : 'catches'}
                      </div>
                    </Link>
                    <div className="relative z-10 flex shrink-0 items-center gap-3 text-sm">
                      <span className="inline-flex items-center gap-1 text-muted-foreground" title={t.isPublic ? 'Published' : 'Private'}>
                        {t.isPublic ? <Globe className="size-4" /> : <Lock className="size-4" />}
                        <span className="hidden sm:inline">{t.isPublic ? 'Published' : 'Private'}</span>
                      </span>
                      <span className="text-brass">♡ {t.likeCount}</span>
                      <TripOwnerMenu
                        trip={t}
                        onChange={() => setVersion((v) => v + 1)}
                        onDeleted={() => setVersion((v) => v + 1)}
                        onRestored={() => setVersion((v) => v + 1)}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {result && result.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <Button variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <span className="text-sm text-muted-foreground">Page {result.page} of {result.totalPages}</span>
            <Button variant="outline" disabled={page >= result.totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
}
