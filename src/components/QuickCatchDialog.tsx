import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Fish } from 'lucide-react';
import type { Trip } from '../types/trip';
import type { Species } from '../types/species';
import { speciesApi } from '../api/species';
import { newId, outbox, syncAll, syncOne, type OutboxCatch, type OutboxEntry } from '../offline/outbox';
import { useAuth } from '../context/useAuth';
import { catchDateRange, tripHeading } from '../utils/trip';
import { MAX_MEDIA_PER_CATCH } from '../utils/media';
import { MediaPicker } from './MediaPicker';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/** A saved trip, or one logged offline that's still waiting on this device. */
export type QuickCatchTarget =
  | { kind: 'saved'; trip: Trip }
  | { kind: 'queued'; entry: OutboxEntry };

/** Name shown for the target trip. */
function targetName(target: QuickCatchTarget): string {
  return target.kind === 'saved' ? tripHeading(target.trip) : target.entry.trip.title || 'your trip (not uploaded yet)';
}

/**
 * "+ Catch" while you're still fishing: species, size and a photo in a few taps (F-27).
 * Goes through the device queue like a new trip, so it also works with no signal: the catch
 * waits on this device and uploads by itself when the connection is back.
 */
export function QuickCatchDialog({ target, open, onOpenChange, onSaved }: {
  target: QuickCatchTarget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Uploaded right away (online): reload the trip to show it. */
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const [species, setSpecies] = useState<Species[]>([]);
  const [speciesId, setSpeciesId] = useState('');
  const [weight, setWeight] = useState('');
  const [length, setLength] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Saved for offline use by OutboxSync, so the list is there with no signal too.
    speciesApi.getAll().then(setSpecies).catch(() => {});
  }, [open]);

  const reset = () => {
    setSpeciesId(''); setWeight(''); setLength(''); setNotes(''); setPhotos([]); setError(null);
  };

  const number = (v: string) => (v.trim() === '' ? null : Number(v));

  const save = async () => {
    setError(null);
    if (!speciesId) { setError('Pick a species.'); return; }
    const w = number(weight);
    const l = number(length);
    if ((w != null && !(w > 0)) || (l != null && !(l > 0))) { setError('Weight and length must be more than 0.'); return; }

    // Dated today (or the trip's last allowed day), like the full form's default.
    const { max } = catchDateRange(target.kind === 'saved' ? target.trip : target.entry.trip);
    const item: OutboxCatch = {
      clientId: newId(),
      payload: {
        speciesId, locationId: null, catchDate: new Date(max).toISOString(), weight: w, length: l,
        gearUsed: null, baitUsed: null, fishingMethod: null, notes: notes.trim() || null,
      },
      media: photos.map((file) => ({ clientId: newId(), file, name: file.name, type: file.type, uploaded: false })),
    };
    const name = species.find((s) => s.id === speciesId)?.commonName ?? 'Catch';

    setSaving(true);
    try {
      if (target.kind === 'queued') {
        // The trip itself hasn't uploaded yet: the catch joins it and goes up with it.
        let outcome: 'queued' | 'missing';
        try {
          outcome = await outbox.addCatchToQueued(target.entry, item);
        } catch {
          setError("Couldn't save on this device (storage full or blocked). Free some space or try online.");
          return;
        }
        if (outcome === 'missing') {
          setError('That trip has already uploaded. Open it from My Trips and add the catch there.');
          return;
        }
        toast.success(`${name} saved with ${targetName(target)}.`, { description: 'It uploads together with the trip.' });
        void syncAll();
      } else {
        const trip = target.trip;
        const entry: OutboxEntry = {
          id: newId(),
          kind: 'catch',
          userId: user!.id,
          createdAt: 0, // stamped by outbox.add
          serverTripId: trip.id,
          trip: {
            title: trip.title, tripDate: trip.tripDate, endDate: trip.endDate, startTime: trip.startTime,
            endTime: trip.endTime, locationId: trip.locationId, notes: trip.notes, weatherConditions: trip.weatherConditions,
          },
          locationName: trip.locationName,
          publishAfterSave: false,
          status: 'pending',
          catches: [item],
        };
        try {
          await outbox.add(entry);
        } catch {
          setError("Couldn't save on this device (storage full or blocked). Free some space or try online.");
          return;
        }
        const result = await syncOne(entry.id);
        if (result.state === 'offline') {
          toast.success(`${name} saved on this device.`, { description: "It will upload by itself when you're back online." });
        } else if (result.state === 'done') {
          toast.success(`${name} added to ${tripHeading(trip)}.`);
          onSaved?.();
        } else {
          toast.warning('The catch needs attention — see "Waiting to upload" in My Trips.', { description: result.error });
        }
      }
      reset();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!saving) onOpenChange(o); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Fish className="size-5" /> Quick catch</DialogTitle>
          <DialogDescription>
            Adds to <strong>{targetName(target)}</strong>. Gear, bait and the rest can be added later
            {target.kind === 'queued' ? ', once the trip has uploaded.' : '.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Species *</Label>
            <Select items={species.map((s) => ({ value: s.id, label: s.commonName }))} value={speciesId} onValueChange={(v) => setSpeciesId(String(v ?? ''))}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select a species..." /></SelectTrigger>
              <SelectContent>
                {species.map((s) => <SelectItem key={s.id} value={s.id}>{s.commonName}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="qc-weight">Weight (kg)</Label>
              <Input id="qc-weight" type="number" inputMode="decimal" step="0.01" min="0" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="qc-length">Length (cm)</Label>
              <Input id="qc-length" type="number" inputMode="decimal" step="0.1" min="0" value={length} onChange={(e) => setLength(e.target.value)} />
            </div>
          </div>
          <MediaPicker files={photos} onChange={setPhotos} maxCount={MAX_MEDIA_PER_CATCH} idPrefix="quick-catch" />
          <div className="space-y-1">
            <Label htmlFor="qc-notes">Notes</Label>
            <Input id="qc-notes" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" />
          </div>
          {error && <p className="m-0 text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          {target.kind === 'saved' ? (
            <Link to={`/trips/${target.trip.id}/catches/new`} className="text-sm text-muted-foreground underline" onClick={() => onOpenChange(false)}>
              Full form
            </Link>
          ) : <span />}
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save catch'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
