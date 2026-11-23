import { useState } from 'react';
import { locationsApi } from '../api/locations';
import type { Location } from '../types/location';
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (location: Location) => void;
}) {
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
    setIsSaving(true);
    setError(null);
    try {
      const created = await locationsApi.create({
        name: name.trim(),
        description: null,
        latitude: point.lat,
        longitude: point.lng,
        waterType,
        isPublic,
      });
      onCreated(created);
      handleOpenChange(false);
    } catch (err) {
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
