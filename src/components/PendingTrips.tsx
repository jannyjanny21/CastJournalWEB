import { Link } from 'react-router-dom';
import { CloudUpload, AlertTriangle, Loader2 } from 'lucide-react';
import { outbox, syncAll, useOutbox, type OutboxEntry } from '../offline/outbox';
import { useOfflineStatus } from '../offline/status';
import { formatTripDates, isStillFishing } from '../utils/trip';
import { useState } from 'react';
import { Fish } from 'lucide-react';
import { QuickCatchDialog } from './QuickCatchDialog';
import { TripStatusBadge } from './TripStatusBadge';
import { catchDraftTarget, useCatchDrafts } from '../offline/drafts';
import { useAuth } from '../context/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useConfirm } from '../hooks/useConfirm';
import { formatMb, useStorageAlmostFull } from '../utils/storage';

function describe(e: OutboxEntry): string {
  if (e.kind === 'catch') {
    const files = e.catches.reduce((n, c) => n + c.media.length, 0);
    return ['Quick catch', files > 0 ? `${files} ${files === 1 ? 'photo/video' : 'photos/videos'}` : null].filter(Boolean).join(' · ');
  }
  const catches = e.catches.length;
  const files = e.catches.reduce((n, c) => n + c.media.length, 0);
  return [
    formatTripDates(e.trip),
    e.locationName,
    `${catches} ${catches === 1 ? 'catch' : 'catches'}`,
    files > 0 ? `${files} ${files === 1 ? 'photo/video' : 'photos/videos'}` : null,
  ].filter(Boolean).join(' · ');
}

/** Trips logged on this device that haven't reached the server yet (F-13). */
export function PendingTrips() {
  const ask = useConfirm();
  const { entries, syncing } = useOutbox();
  const { online } = useOfflineStatus();
  const [catchFor, setCatchFor] = useState<OutboxEntry | null>(null);
  const { user } = useAuth();
  const hasCatchDraft = useCatchDrafts(user?.id);
  const almostFull = useStorageAlmostFull(entries);
  if (entries.length === 0) return null;

  return (
    <section className="mb-6 space-y-3" aria-label="Waiting to upload">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 flex items-center gap-2 font-heading text-lg">
          <CloudUpload className="size-5" /> Waiting to upload ({entries.length})
        </h2>
        {online && entries.some((e) => e.status === 'pending') && (
          <Button variant="outline" size="sm" disabled={syncing} onClick={() => { void syncAll(); }}>
            {syncing ? 'Uploading…' : 'Upload now'}
          </Button>
        )}
      </div>

      {almostFull && (
        <p className="m-0 flex items-start gap-2 rounded-lg border border-[color:var(--color-brass)]/50 bg-muted/40 p-3 text-sm" role="status">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[color:var(--color-brass)]" />
          <span>
            Storage for CastJournal on this device is almost full ({formatMb(almostFull.free)} left). Upload these when
            you have signal, or free up space before adding more photos and videos.
          </span>
        </p>
      )}

      {entries.map((e) => (
        <Card key={e.id} className="border-dashed">
          <CardContent className="space-y-1.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="flex min-w-0 items-center gap-2">
                  <strong className="truncate">
                    {e.kind === 'catch' ? `Catch for ${e.trip.title || 'your trip'}` : e.trip.title || 'Fishing trip'}
                  </strong>
                  {e.kind !== 'catch' && <TripStatusBadge trip={e.trip} isOwner className="shrink-0" />}
                </span>
                <div className="font-mono text-sm text-muted-foreground">{describe(e)}</div>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                {e.status === 'syncing' && <><Loader2 className="size-3.5 animate-spin" /> Uploading…</>}
                {e.status === 'pending' && (online ? 'Waiting to upload' : 'Waiting for a connection')}
                {(e.status === 'failed' || e.status === 'attention') && (
                  <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="size-3.5" /> Needs attention</span>
                )}
              </span>
            </div>

            {e.error && <p className="m-0 text-sm text-destructive">{e.error}</p>}

            {e.status === 'failed' && (
              <p className="m-0 text-xs text-muted-foreground">
                The server didn't accept this trip. If the location or species was removed, discard it and log it again.
              </p>
            )}

            <div className="flex flex-wrap gap-2">
              {e.kind !== 'catch' && !e.serverTripId && e.status !== 'failed' && isStillFishing(e.trip) && (
                <Button size="sm" onClick={() => setCatchFor(e)}>
                  <Fish className="size-4" />
                  {hasCatchDraft(catchDraftTarget.queued(e.id)) ? <>Continue catch <span className="size-2 rounded-full bg-[color:var(--color-brass)]" aria-hidden="true" /></> : 'Quick catch'}
                </Button>
              )}
              {e.status === 'attention' && e.serverTripId && (
                <Link to={`/trips/${e.serverTripId}`}><Button size="sm" variant="outline">Open trip</Button></Link>
              )}
              {(e.status === 'failed' || e.status === 'attention') && (
                <Button size="sm" variant="outline" disabled={!online} onClick={() => { void outbox.retry(e.id); }}>
                  Try again
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="text-muted-foreground hover:text-destructive"
                disabled={e.status === 'syncing'}
                onClick={async () => {
                  const what = e.kind === 'catch' ? 'catch' : 'trip';
                  const ok = await ask(e.status === 'attention'
                    ? { title: 'Stop trying?', description: `The ${what} is saved as far as it got; only the parts that failed will be dropped.`, confirmLabel: 'Dismiss' }
                    : { title: `Discard this ${what}?`, description: 'It hasn’t been uploaded, so it will be lost.', confirmLabel: 'Discard', destructive: true });
                  if (ok) void outbox.remove(e.id);
                }}
              >
                {e.status === 'attention' ? 'Dismiss' : 'Discard'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {catchFor && (
        <QuickCatchDialog target={{ kind: 'queued', entry: catchFor }} open onOpenChange={(o) => { if (!o) setCatchFor(null); }} />
      )}
    </section>
  );
}
