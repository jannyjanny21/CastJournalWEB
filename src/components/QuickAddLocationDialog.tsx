import { useState } from 'react';
import { locationsApi } from '../api/locations';
import { isOfflineError } from '../api/client';
import { useOfflineStatus } from '../offline/status';
import type { CreateLocationPayload, Location } from '../types/location';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MapPicker, type LatLng } from './map/MapPicker';

const WATER_TYPES = ['Freshwater', 'Saltwater', 'Brackish'] as const;

export function QuickAddLocationDialog({
  open,
  onOpenChange,
  onCreated,
  onSavedOffline,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (location: Location) => void;
  /**
   * Offline (F-13): keep the spot on the device instead; it is uploaded with the trip it's used for.
   * Without this, adding a spot needs a connection.
   */
  onSavedOffline?: (location: CreateLocationPayload) => void;
}) {
  const { online } = useOfflineStatus();
  const [name, setName] = useState('');
  const [waterType, setWaterType] = useState<(typeof WATER_TYPES)[number]>('Freshwater');
  const [isPublic, setIsPublic] = useState(false);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName('');
    setWaterType('Freshwater');
    setIsPublic(false);
    setPoint(null);
    setError(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('Give the spot a name.');
      return;
    }
    // Weather, tides and the map all depend on the position, so a pin is required.
    if (!point) {
      setError('Place a pin on the map, or use your location.');
      return;
    }
    const payload: CreateLocationPayload = {
      name: name.trim(),
      description: null,
      latitude: point.lat,
      longitude: point.lng,
      waterType,
      isPublic,
    };
    const keepOnDevice = () => {
      onSavedOffline!(payload);
      handleOpenChange(false);
    };
    if (!online) {
      if (onSavedOffline) keepOnDevice();
      else setError('Adding a spot needs a connection. Try again when you\'re back online.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const created = await locationsApi.create(payload);
      onCreated(created);
      handleOpenChange(false);
    } catch (err) {
      if (isOfflineError(err) && onSavedOffline) {
        keepOnDevice();
        return;
      }
      setError(err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : "Couldn't save that location — try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add a location</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="quick-location-name">Name</Label>
            <Input
              id="quick-location-name"
              autoFocus
              placeholder="e.g. Willow Creek Bridge"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <Label>Position *</Label>
            {!online && (
              <p className="mb-2 text-xs text-muted-foreground">
                You're offline, so the map may stay blank. Tap <strong>Use my location</strong>: GPS works without signal
                (the first fix can take a minute in the open).
                {onSavedOffline && ' The spot is saved with this trip when it uploads.'}
              </p>
            )}
            <MapPicker value={point} onChange={setPoint} height={220} />
          </div>

          <div>
            <Label>Water type</Label>
            <Select
              items={WATER_TYPES.map((w) => ({ value: w, label: w }))}
              value={waterType}
              onValueChange={(v) => setWaterType(v as (typeof WATER_TYPES)[number])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WATER_TYPES.map((w) => (
                  <SelectItem key={w} value={w}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox checked={isPublic} onCheckedChange={(c) => setIsPublic(c === true)} />
            <Label className="!mt-0">Make this location public</Label>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Add location'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
