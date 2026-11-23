import { CloudOff } from 'lucide-react';
import { useOfflineStatus } from '../offline/status';
import { useOutbox } from '../offline/outbox';
import { Link } from 'react-router-dom';

function savedAgo(ts: number): string {
  const mins = Math.round((Date.now() - ts) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Shown while there's no connection, or when the page on screen is a saved copy (F-13). */
export function OfflineBanner() {
  const { online, savedCopyFrom } = useOfflineStatus();
  const { entries, syncing } = useOutbox();
  const waiting = entries.filter((e) => e.status === 'pending' || e.status === 'syncing').length;
  const needsAttention = entries.filter((e) => e.status === 'failed' || e.status === 'attention').length;

  const offline = !online || savedCopyFrom != null;
  if (!offline && waiting === 0 && needsAttention === 0) return null;

  const trips = (n: number) => `${n} ${n === 1 ? 'trip' : 'trips'}`;

  return (
    <div
      role="status"
      className="flex items-start justify-center gap-2 border-b border-[color:var(--color-brass)]/30 bg-[color:var(--color-brass)]/10 px-6 py-2 text-sm"
    >
      <CloudOff className="mt-0.5 size-4 shrink-0" />
      <span>
        {offline ? (
          <>
            <strong>You're offline.</strong>{' '}
            {savedCopyFrom != null
              ? `Showing what was saved on this device (${savedAgo(savedCopyFrom)}). `
              : 'Pages you opened before are saved on this device. '}
            New trips are saved here and upload when you're back online; edits need a connection.
            {waiting > 0 && <> <Link to="/trips" className="underline">{trips(waiting)} waiting</Link>.</>}
          </>
        ) : (
          <>
            {waiting > 0 && <>{syncing ? 'Uploading' : 'Waiting to upload'} {trips(waiting)} logged on this device… </>}
            {needsAttention > 0 && (
              <Link to="/trips" className="underline">{trips(needsAttention)} couldn't upload — see My Trips.</Link>
            )}
          </>
        )}
      </span>
    </div>
  );
}
