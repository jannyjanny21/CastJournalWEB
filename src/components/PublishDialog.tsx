import { useEffect, useState } from 'react';
import { Eye, MapPin, EyeOff } from 'lucide-react';
import { tripsApi } from '../api/trips';
import type { PublishPreview, Trip } from '../types/trip';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type LocationChoice = 'show' | 'hide' | null;

/**
 * Publish a trip (FR-43) after showing what other anglers will see (FR-45). If the trip uses the
 * angler's private spots, they must choose: show them (explicit confirmation) or publish without them.
 */
export function PublishDialog({
  tripId,
  open,
  onOpenChange,
  onPublished,
}: {
  tripId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPublished: (trip: Trip) => void;
}) {
  const [preview, setPreview] = useState<{ id: string; data?: PublishPreview; error?: string } | null>(null);
  const [choice, setChoice] = useState<LocationChoice>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    tripsApi
      .getPublishPreview(tripId)
      .then((data) => { if (!cancelled) setPreview({ id: tripId, data }); })
      .catch(() => { if (!cancelled) setPreview({ id: tripId, error: "Couldn't load the preview." }); });
    return () => { cancelled = true; };
  }, [open, tripId]);

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setChoice(null);
      setError(null);
    }
    onOpenChange(next);
  };

  const data = preview?.id === tripId ? preview.data : undefined;
  const privateSpots = data?.privateLocations ?? [];
  const needsChoice = privateSpots.length > 0;
  const canPublish = !!data && (!needsChoice || choice !== null) && !busy;

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      const trip = await tripsApi.publish(tripId, needsChoice && choice === 'show');
      onPublished(trip);
      handleOpenChange(false);
    } catch (err) {
      setError(err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : "Couldn't publish — try again.");
    } finally {
      setBusy(false);
    }
  };

  const spotNames = privateSpots.map((p) => p.name).join(', ');

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{data?.isPublic ? 'Update published trip' : 'Publish this trip?'}</DialogTitle>
        </DialogHeader>

        {!data && !preview?.error && <p className="text-sm text-muted-foreground">Loading preview…</p>}
        {preview?.error && <p className="text-sm text-destructive">{preview.error}</p>}

        {data && (
          <div className="space-y-4 text-sm">
            <div>
              <p className="mb-1 flex items-center gap-1.5 font-medium"><Eye className="size-4" /> Other anglers will see</p>
              <ul className="m-0 list-disc space-y-0.5 pl-5">
                {data.visible.map((v) => <li key={v}>{v}</li>)}
              </ul>
            </div>

            {needsChoice && (
              <fieldset className="space-y-2 rounded-lg border border-[color:var(--color-brass)]/40 bg-[color:var(--color-brass)]/5 p-3">
                <legend className="px-1 font-medium">
                  This trip uses your private {privateSpots.length === 1 ? 'spot' : 'spots'}: {spotNames}
                </legend>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name="location-choice"
                    className="mt-1"
                    checked={choice === 'hide'}
                    onChange={() => setChoice('hide')}
                  />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium"><EyeOff className="size-4" /> Publish without the location</span>
                    <span className="text-muted-foreground">Others see "Location hidden". Your spot stays private.</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2">
                  <input
                    type="radio"
                    name="location-choice"
                    className="mt-1"
                    checked={choice === 'show'}
                    onChange={() => setChoice('show')}
                  />
                  <span>
                    <span className="flex items-center gap-1.5 font-medium"><MapPin className="size-4" /> Show the spot on this trip</span>
                    <span className="text-muted-foreground">
                      I understand other anglers will see the name and map position of {spotNames} on this trip.
                      It stays out of public spot lists, and withdrawing the trip hides it again.
                    </span>
                  </span>
                </label>
              </fieldset>
            )}

            <p className="text-xs text-muted-foreground">You can withdraw the trip at any time from its page.</p>
            {error && <p className="text-destructive" role="alert">{error}</p>}
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
          <Button type="button" onClick={publish} disabled={!canPublish}>
            {busy ? 'Publishing…' : data?.isPublic ? 'Update' : 'Publish'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
