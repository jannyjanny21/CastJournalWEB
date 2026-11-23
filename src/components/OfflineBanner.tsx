import { CloudOff } from 'lucide-react';
import { useOfflineStatus } from '../offline/status';

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
  if (online && savedCopyFrom == null) return null;

  return (
    <div
      role="status"
      className="flex items-start justify-center gap-2 border-b border-[color:var(--color-brass)]/30 bg-[color:var(--color-brass)]/10 px-6 py-2 text-sm"
    >
      <CloudOff className="mt-0.5 size-4 shrink-0" />
      <span>
        <strong>You're offline.</strong>{' '}
        {savedCopyFrom != null
          ? `Showing what was saved on this device (${savedAgo(savedCopyFrom)}). `
          : 'Pages you opened before are saved on this device. '}
        Changes need a connection.
      </span>
    </div>
  );
}
