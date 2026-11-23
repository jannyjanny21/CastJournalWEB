import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Globe, Lock } from 'lucide-react';
import { tripsApi } from '../../api/trips';
import type { PagedResult } from '../../types/catch';
import type { Trip } from '../../types/trip';
import { formatTripDates, tripHeading } from '../../utils/trip';
import { PageHeader } from '../../components/PageHeader';
import { CatchRowSkeleton } from '../../components/CatchRowSkeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function MyTrips() {
  const [result, setResult] = useState<PagedResult<Trip> | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await tripsApi.getMine({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          page,
          pageSize: 10,
        });
        if (!cancelled) setResult(res);
      } catch {
        if (!cancelled) setError('Could not load your trips.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [startDate, endDate, page]);

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
        </div>
      </PageHeader>

      <div className="pt-6">
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
                <p>No trips in that date range.</p>
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
            {result?.items.map((t) => (
              <Link key={t.id} to={`/trips/${t.id}`} className="text-inherit no-underline">
                <Card interactive>
                  <CardContent className="flex flex-row items-center justify-between gap-3">
                    <div className="min-w-0">
                      <strong className="block truncate">{tripHeading(t)}</strong>
                      <div className="font-mono text-sm text-muted-foreground">
                        {formatTripDates(t)} · {t.locationName ?? 'No location'} · {t.catchCount}{' '}
                        {t.catchCount === 1 ? 'catch' : 'catches'}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-3 text-sm">
                      <span className="inline-flex items-center gap-1 text-muted-foreground" title={t.isPublic ? 'Published' : 'Private'}>
                        {t.isPublic ? <Globe className="size-4" /> : <Lock className="size-4" />}
                      </span>
                      <span className="text-brass">♡ {t.likeCount}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
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
