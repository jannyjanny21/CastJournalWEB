import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/useAuth';
import { onTripUploaded, outbox, syncAll } from '../offline/outbox';
import { speciesApi } from '../api/species';
import { locationsApi } from '../api/locations';
import { contentCategoriesApi } from '../api/contentCategories';

const RETRY_EVERY_MS = 60_000;

/**
 * Runs the offline upload queue (F-13): on sign-in, when the connection comes back, and every
 * minute while anything is waiting. Also saves the lists the trip form needs (species, your
 * locations, gear/bait/method), so a trip can be logged on a device that's never been offline before.
 */
export function OutboxSync() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const userId = user?.id ?? null;

  useEffect(() => {
    outbox.setUser(userId);
    if (!userId) return;

    if (navigator.onLine) {
      void speciesApi.getAll().catch(() => {});
      void locationsApi.getMine().catch(() => {});
      void contentCategoriesApi.getAll().catch(() => {});
    }
    void syncAll();

    const onOnline = () => { void syncAll(); };
    window.addEventListener('online', onOnline);
    const timer = window.setInterval(() => { void syncAll(); }, RETRY_EVERY_MS);
    return () => {
      window.removeEventListener('online', onOnline);
      window.clearInterval(timer);
    };
  }, [userId]);

  useEffect(
    () =>
      onTripUploaded((entry, tripId) => {
        if (entry.kind === 'catch') {
          toast.success(`Catch added to ${entry.trip.title || 'your trip'}.`, {
            action: { label: 'Open', onClick: () => navigate(`/trips/${tripId}`) },
          });
          return;
        }
        const name = entry.trip.title || 'Your trip';
        toast.success(`${name} uploaded.`, {
          description: entry.publishAfterSave ? 'Open it to review and publish.' : undefined,
          action: {
            label: entry.publishAfterSave ? 'Publish…' : 'Open',
            onClick: () => navigate(`/trips/${tripId}`, { state: entry.publishAfterSave ? { openPublish: true } : undefined }),
          },
        });
      }),
    [navigate],
  );

  return null;
}
