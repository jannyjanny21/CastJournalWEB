import { useEffect, useState } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { tripsApi } from '../../api/trips';
import { catchesApi } from '../../api/catches';
import { speciesApi } from '../../api/species';
import { locationsApi } from '../../api/locations';
import type { Species } from '../../types/species';
import type { Location } from '../../types/location';
import type { CreateCatchPayload } from '../../types/catch';
import type { UpdateTripPayload } from '../../types/trip';
import { fromTimeInput, toTimeInput } from '../../utils/trip';
import { CastDivider } from '../../components/CastDivider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { QuickAddLocationDialog } from '../../components/QuickAddLocationDialog';

const NO_LOCATION = '__none__';
const ADD_NEW_LOCATION = '__add_new__';

const positiveOrEmpty = z
  .string()
  .refine((v) => v === '' || (Number(v) > 0 && Number(v) < 1_000_000), 'Must be greater than 0');

const catchSchema = z.object({
  speciesId: z.string().min(1, 'Species is required'),
  weight: positiveOrEmpty,
  length: positiveOrEmpty,
  gearUsed: z.string().max(100, 'At most 100 characters'),
  baitUsed: z.string().max(100, 'At most 100 characters'),
  fishingMethod: z.string().max(100, 'At most 100 characters'),
  notes: z.string().max(1000, 'At most 1000 characters'),
});

const tripFormSchema = z
  .object({
    title: z.string().max(150, 'At most 150 characters'),
    tripDate: z.string().min(1, 'Date is required'),
    startTime: z.string(),
    endTime: z.string(),
    locationId: z.string(),
    weatherConditions: z.string().max(500, 'At most 500 characters'),
    notes: z.string().max(1000, 'At most 1000 characters'),
    isPublic: z.boolean(),
    catches: z.array(catchSchema),
  })
  .refine((v) => !v.startTime || !v.endTime || v.endTime >= v.startTime, {
    message: "End time can't be before the start time",
    path: ['endTime'],
  });

type TripFormValues = z.infer<typeof tripFormSchema>;
type CatchValues = z.infer<typeof catchSchema>;

const emptyCatch: CatchValues = {
  speciesId: '', weight: '', length: '', gearUsed: '', baitUsed: '', fishingMethod: '', notes: '',
};

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toCatchPayload(c: CatchValues, tripDate: string): CreateCatchPayload {
  return {
    speciesId: c.speciesId,
    locationId: null, // uses the trip's location; a different spot per catch can be set when editing the catch
    catchDate: new Date(tripDate).toISOString(),
    weight: c.weight ? parseFloat(c.weight) : null,
    length: c.length ? parseFloat(c.length) : null,
    gearUsed: c.gearUsed || null,
    baitUsed: c.baitUsed || null,
    fishingMethod: c.fishingMethod || null,
    notes: c.notes || null,
  };
}

function errorMessage(err: unknown): string {
  return err && typeof err === 'object' && 'message' in err
    ? String((err as { message: unknown }).message)
    : 'Something went wrong. Please try again.';
}

/** Log a new trip (with any number of catches) or edit an existing trip's details. */
export function TripForm() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();

  const [species, setSpecies] = useState<Species[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  // Photos per catch row, keyed by the row's useFieldArray id.
  const [photos, setPhotos] = useState<Record<string, File[]>>({});

  const form = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: {
      title: '',
      tripDate: todayLocal(),
      startTime: '',
      endTime: '',
      locationId: '',
      weatherConditions: '',
      notes: '',
      isPublic: false,
      catches: isEdit ? [] : [emptyCatch],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'catches' });

  useEffect(() => {
    speciesApi.getAll().then(setSpecies).catch(() => {});
    locationsApi.getMine().then(setLocations).catch(() => {});

    if (isEdit) {
      tripsApi.getById(id!).then((t) => {
        form.reset({
          title: t.title ?? '',
          tripDate: t.tripDate,
          startTime: toTimeInput(t.startTime),
          endTime: toTimeInput(t.endTime),
          locationId: t.locationId ?? '',
          weatherConditions: t.weatherConditions ?? '',
          notes: t.notes ?? '',
          isPublic: t.isPublic,
          catches: [],
        });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  const onSubmit = async (values: TripFormValues) => {
    const tripPayload: UpdateTripPayload = {
      title: values.title.trim() || null,
      tripDate: values.tripDate,
      startTime: fromTimeInput(values.startTime),
      endTime: fromTimeInput(values.endTime),
      locationId: values.locationId || null,
      notes: values.notes || null,
      weatherConditions: values.weatherConditions || null,
      isPublic: values.isPublic,
    };

    try {
      if (isEdit) {
        await tripsApi.update(id!, tripPayload);
        navigate(`/trips/${id}`);
        return;
      }

      // Create the trip, then add each catch in order so each one's photos go to the right catch.
      const trip = await tripsApi.create({ ...tripPayload, catches: [] });
      try {
        for (let i = 0; i < values.catches.length; i++) {
          const created = await tripsApi.addCatch(trip.id, toCatchPayload(values.catches[i], values.tripDate));
          for (const file of photos[fields[i].id] ?? []) {
            await catchesApi.uploadMedia(created.id, file);
          }
        }
      } catch (err) {
        // The trip exists; send the angler there so they can finish adding catches.
        navigate(`/trips/${trip.id}`, { state: { warning: `Trip saved, but not every catch or photo was: ${errorMessage(err)}` } });
        return;
      }

      navigate(`/trips/${trip.id}`);
    } catch (err) {
      form.setError('root', { message: errorMessage(err) });
    }
  };

  const speciesItems = species.map((s) => ({ value: s.id, label: s.commonName }));

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? 'Edit trip' : 'Log a trip'}</CardTitle>
        </CardHeader>
        <CardContent>
          <CastDivider />

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl><Input type="text" placeholder="e.g. Morning at the river mouth" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="tripDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date *</FormLabel>
                      <FormControl><Input type="date" max={todayLocal()} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <Select
                      items={[
                        { value: NO_LOCATION, label: 'No location' },
                        ...locations.map((l) => ({ value: l.id, label: l.name })),
                        { value: ADD_NEW_LOCATION, label: '+ Add new location' },
                      ]}
                      value={field.value || NO_LOCATION}
                      onValueChange={(v) => {
                        if (v === ADD_NEW_LOCATION) {
                          setQuickAddOpen(true);
                          return;
                        }
                        field.onChange(v === NO_LOCATION ? '' : v);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="No location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_LOCATION}>No location</SelectItem>
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
                name="weatherConditions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Weather</FormLabel>
                    <FormControl><Input type="text" placeholder="e.g. Clear, light breeze" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Trip notes</FormLabel>
                    <FormControl><Textarea rows={3} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!isEdit && (
                <div className="space-y-4">
                  <h3 className="font-heading text-lg">Catches</h3>
                  {fields.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No catches — that's fine, a trip without fish still counts.
                    </p>
                  )}

                  {fields.map((row, index) => (
                    <div key={row.id} className="space-y-3 rounded-lg border border-border p-3">
                      <div className="flex items-center justify-between">
                        <strong className="text-sm">Catch {index + 1}</strong>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPhotos((prev) => {
                              const next = { ...prev };
                              delete next[row.id];
                              return next;
                            });
                            remove(index);
                          }}
                          className="px-2 text-muted-foreground hover:text-destructive"
                          aria-label={`Remove catch ${index + 1}`}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>

                      <FormField
                        control={form.control}
                        name={`catches.${index}.speciesId`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Species *</FormLabel>
                            <Select items={speciesItems} value={field.value} onValueChange={field.onChange}>
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
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name={`catches.${index}.weight`}
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
                          name={`catches.${index}.length`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Length (cm)</FormLabel>
                              <FormControl><Input type="number" step="any" min="0.01" {...field} /></FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        {(['gearUsed', 'baitUsed', 'fishingMethod'] as const).map((name) => (
                          <FormField
                            key={name}
                            control={form.control}
                            name={`catches.${index}.${name}`}
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>{name === 'gearUsed' ? 'Gear' : name === 'baitUsed' ? 'Bait' : 'Method'}</FormLabel>
                                <FormControl><Input type="text" {...field} /></FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        ))}
                      </div>

                      <FormField
                        control={form.control}
                        name={`catches.${index}.notes`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl><Textarea rows={2} {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormItem>
                        <FormLabel htmlFor={`photos-${row.id}`}>Photos</FormLabel>
                        <Input
                          id={`photos-${row.id}`}
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(e) => {
                            const files = Array.from(e.target.files ?? []);
                            setPhotos((prev) => ({ ...prev, [row.id]: files }));
                          }}
                        />
                      </FormItem>
                    </div>
                  ))}

                  <Button type="button" variant="outline" onClick={() => append({ ...emptyCatch })}>
                    <Plus className="size-4" />
                    Add a catch
                  </Button>
                </div>
              )}

              <FormField
                control={form.control}
                name="isPublic"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="!mt-0">Publish this trip to the community feed</FormLabel>
                  </FormItem>
                )}
              />

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
                  {form.formState.isSubmitting ? 'Saving...' : 'Save trip'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
