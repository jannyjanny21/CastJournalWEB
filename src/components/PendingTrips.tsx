import { Link } from 'react-router-dom';
import { CloudUpload, AlertTriangle, Loader2 } from 'lucide-react';
import { outbox, syncAll, useOutbox, type OutboxEntry } from '../offline/outbox';
import { useOfflineStatus } from '../offline/status';
import { formatTripDates } from '../utils/trip';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useConfirm } from '../hooks/useConfirm';

function describe(e: OutboxEntry): string {
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

      {entries.map((e) => (
        <Card key={e.id} className="border-dashed">
          <CardContent className="space-y-1.5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <strong className="block truncate">{e.trip.title || 'Fishing trip'}</strong>
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
                  const ok = await ask(e.status === 'attention'
                    ? { title: 'Stop trying?', description: 'The trip is already saved; only the parts that failed will be dropped.', confirmLabel: 'Dismiss' }
                    : { title: 'Discard this trip?', description: 'It hasn’t been uploaded, so it will be lost.', confirmLabel: 'Discard', destructive: true });
                  if (ok) void outbox.remove(e.id);
                }}
              >
                {e.status === 'attention' ? 'Dismiss' : 'Discard'}
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
