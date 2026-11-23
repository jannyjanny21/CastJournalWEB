import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { catchesApi } from '../../api/catches';
import { tripsApi } from '../../api/trips';
import { speciesApi } from '../../api/species';
import { RequestSpeciesLink } from '../../components/RequestSpeciesDialog';
import { locationsApi } from '../../api/locations';
import type { Species } from '../../types/species';
import type { Location } from '../../types/location';
import { CastDivider } from '../../components/CastDivider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { QuickAddLocationDialog } from '../../components/QuickAddLocationDialog';
import { CategorySelect } from '../../components/CategorySelect';
import { useCatchCategories } from '../../hooks/useCatchCategories';

const NO_LOCATION = '__none__';
const ADD_NEW_LOCATION = '__add_new__';

const catchFormSchema = z.object({
  speciesId: z.string().min(1, 'Species is required'),
  locationId: z.string(),
  catchDate: z.string().min(1, 'Date is required'),
  weight: z.string(),
  length: z.string(),
  gearUsed: z.string().max(100, 'At most 100 characters'),
  baitUsed: z.string().max(100, 'At most 100 characters'),
  fishingMethod: z.string().max(100, 'At most 100 characters'),
  notes: z.string().max(1000, 'At most 1000 characters'),
});

type CatchFormValues = z.infer<typeof catchFormSchema>;

const emptyValues: CatchFormValues = {
  speciesId: '',
  locationId: '',
  catchDate: new Date().toISOString().slice(0, 10),
  weight: '',
  length: '',
  gearUsed: '',
  baitUsed: '',
  fishingMethod: '',
  notes: '',
};

/**
 * Adds a catch to a trip (/trips/:tripId/catches/new) or edits one (/catches/:id/edit).
 * Visibility and weather belong to the trip, so they're edited on the trip instead.
 */
export function CatchForm() {
  const { id, tripId: tripIdParam } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [tripId, setTripId] = useState<string | undefined>(tripIdParam);

  const [species, setSpecies] = useState<Species[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const categories = useCatchCategories();

  const form = useForm<CatchFormValues>({
    resolver: zodResolver(catchFormSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    speciesApi.getAll().then(setSpecies).catch(() => {});
    locationsApi.getMine().then(setLocations).catch(() => {});

    if (!isEdit && tripIdParam) {
      // Default the catch date to the trip's date.
      tripsApi.getById(tripIdParam).then((trip) => form.setValue('catchDate', trip.tripDate)).catch(() => {});
    }

    if (isEdit) {
      catchesApi.getById(id!).then((c) => {
        setTripId(c.tripId);
        form.reset({
          speciesId: c.speciesId,
          locationId: c.locationId ?? '',
          catchDate: c.catchDate.slice(0, 10),
          weight: c.weight?.toString() ?? '',
          length: c.length?.toString() ?? '',
          gearUsed: c.gearUsed ?? '',
          baitUsed: c.baitUsed ?? '',
          fishingMethod: c.fishingMethod ?? '',
          notes: c.notes ?? '',
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const onSubmit = async (values: CatchFormValues) => {
    const payload = {
      speciesId: values.speciesId,
      locationId: values.locationId || null,
      catchDate: new Date(values.catchDate).toISOString(),
      weight: values.weight ? parseFloat(values.weight) : null,
      length: values.length ? parseFloat(values.length) : null,
      gearUsed: values.gearUsed || null,
      baitUsed: values.baitUsed || null,
      fishingMethod: values.fishingMethod || null,
      notes: values.notes || null,
    };

    try {
      let catchId = id;
      if (isEdit) {
        await catchesApi.update(id!, payload);
      } else {
        if (!tripId) throw { message: 'Open a trip first, then add a catch to it.' };
        const created = await tripsApi.addCatch(tripId, payload);
        catchId = created.id;
      }

      for (const photo of photos) {
        await catchesApi.uploadMedia(catchId!, photo);
      }

      navigate(tripId ? `/trips/${tripId}` : '/trips');
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Something went wrong. Please try again.';
      form.setError('root', { message });
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? 'Edit catch' : 'Add a catch to this trip'}</CardTitle>
        </CardHeader>
        <CardContent>
          <CastDivider />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="speciesId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Species *</FormLabel>
                    <Select
                      items={species.map((s) => ({ value: s.id, label: s.commonName }))}
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a species..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {species.map((s) => (
                          <SelectItem key={s.id} value={s.id}>{s.commonName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                    <RequestSpeciesLink />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location (if different from the trip's)</FormLabel>
                    <Select
                      items={[
                        { value: NO_LOCATION, label: 'Same as the trip' },
                        ...locations.map((l) => ({ value: l.id, label: l.name })),
                        { value: ADD_NEW_LOCATION, label: '+ Add new location' },
                      ]}
                      value={field.value || NO_LOCATION}
                      onValueChange={(v) => {
                        if (v === ADD_NEW_LOCATION) {
                          setQuickAddOpen(true);
                          return; // don't touch field.value — dialog decides what gets selected
                        }
                        field.onChange(v === NO_LOCATION ? '' : v);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Same as the trip" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_LOCATION}>Same as the trip</SelectItem>
                        {locations.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                        ))}
                        <SelectItem value={ADD_NEW_LOCATION}>+ Add new location</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />

                    <QuickAddLocationDialog
                      open={quickAddOpen}
                      onOpenChange={setQuickAddOpen}
                      onCreated={(newLocation) => {
                        setLocations((prev) => [...prev, newLocation]);
                        field.onChange(newLocation.id);
                      }}
                    />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="catchDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date caught</FormLabel>
                    <FormControl><Input type="date" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Weight (kg)</FormLabel>
                      <FormControl><Input type="number" step="0.01" min="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="length"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Length (cm)</FormLabel>
                      <FormControl><Input type="number" step="any" min="0.01" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="gearUsed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gear used</FormLabel>
                    <CategorySelect value={field.value} onChange={field.onChange} options={categories.gear} />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="baitUsed"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bait used</FormLabel>
                    <CategorySelect value={field.value} onChange={field.onChange} options={categories.bait} />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="fishingMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Method</FormLabel>
                    <CategorySelect value={field.value} onChange={field.onChange} options={categories.method} />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl><Textarea rows={3} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormItem>
                <FormLabel htmlFor="photos">Photos</FormLabel>
                <Input
                  id="photos"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
                />
              </FormItem>

              {form.formState.errors.root && (
                <p className="text-sm text-destructive" role="alert">
                  {form.formState.errors.root.message}
                </p>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting} className="flex-1">
                  {form.formState.isSubmitting ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
