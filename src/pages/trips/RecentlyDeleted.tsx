import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { tripsApi } from '../../api/trips';
import type { DeletedTrip } from '../../types/trip';
import { formatTripDates } from '../../utils/trip';
import { apiErrorMessage } from '../../utils/errorMessage';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

function daysLeft(until: string): number {
  return Math.max(0, Math.ceil((new Date(until).getTime() - Date.now()) / 86_400_000));
}

/** Trips deleted in the last 30 days, which can be brought back (B-24). */
export function RecentlyDeleted() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<DeletedTrip[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    tripsApi
      .getDeleted()
      .then((t) => { if (!cancelled) setTrips(t); })
      .catch((err) => { if (!cancelled) setError(apiErrorMessage(err, "Couldn't load deleted trips.")); });
    return () => { cancelled = true; };
  }, []);

  const restore = async (t: DeletedTrip) => {
    setBusy(t.id);
    try {
      await tripsApi.restore(t.id);
      toast.success(t.wasPublic ? 'Trip restored as private. Publish it again if you want.' : 'Trip restored.');
      navigate(`/trips/${t.id}`);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't restore this trip."));
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/trips" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground no-underline hover:text-foreground">
        <ArrowLeft className="size-4" /> My Trips
      </Link>
      <h1 className="font-heading text-2xl">Recently deleted</h1>
      <p className="text-sm text-muted-foreground">
        Deleted trips stay here for 30 days with their catches, then they're removed permanently. A restored trip
        comes back private.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {!trips && !error && <p className="text-muted-foreground">Loading…</p>}
      {trips?.length === 0 && <p className="text-muted-foreground">Nothing deleted in the last 30 days.</p>}

      <div className="mt-4 space-y-3">
        {trips?.map((t) => (
          <Card key={t.id}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <strong className="block truncate">{t.title || 'Fishing trip'}</strong>
                <div className="font-mono text-sm text-muted-foreground">
                  {[formatTripDates(t), t.locationName, `${t.catchCount} ${t.catchCount === 1 ? 'catch' : 'catches'}`]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
                <div className="text-xs text-muted-foreground">
                  Deleted {new Date(t.deletedAt).toLocaleDateString()} · {daysLeft(t.restorableUntil)} days left to restore
                </div>
              </div>
              <Button variant="outline" size="sm" disabled={busy !== null} onClick={() => restore(t)}>
                <RotateCcw className="size-4" /> {busy === t.id ? 'Restoring…' : 'Restore'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
