import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { tripsApi } from '../../api/trips';
import { speciesApi } from '../../api/species';
import { RequestSpeciesLink } from '../../components/RequestSpeciesDialog';
import { MediaPicker } from '../../components/MediaPicker';
import { MAX_MEDIA_PER_CATCH } from '../../utils/media';
import { locationsApi } from '../../api/locations';
import type { Species } from '../../types/species';
import type { Location } from '../../types/location';
import type { CreateCatchPayload } from '../../types/catch';
import type { UpdateTripPayload } from '../../types/trip';
import {
  MAX_TRIP_DAYS, addDaysToDate, conditionMoments, fromTimeInput, lastTripDay, nowTimeInput, toTimeInput, tripDays,
} from '../../utils/trip';
import { CastDivider } from '../../components/CastDivider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { QuickAddLocationDialog } from '../../components/QuickAddLocationDialog';
import { CategorySelect } from '../../components/CategorySelect';
import { useCatchCategories } from '../../hooks/useCatchCategories';
import { ConditionsPanel } from '../../components/ConditionsPanel';
import { newId, outbox, syncOne, type OutboxEntry } from '../../offline/outbox';
import { useOfflineStatus } from '../../offline/status';
import { useAuth } from '../../context/useAuth';
import { toast } from 'sonner';
import { to12h } from '../../utils/time';

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
  /** Which day of a multi-day or overnight trip; '' = the first day. */
  day: z.string(),
});

const tripFormSchema = z
  .object({
    title: z.string().max(150, 'At most 150 characters'),
    tripDate: z.string().min(1, 'Date is required'),
    startTime: z.string().min(1, 'Start time is required'),
    endTime: z.string(),
    stillFishing: z.boolean(),
    /** Camping/offshore trips over several days (up to 7). */
    multiDay: z.boolean(),
    endDate: z.string(),
    locationId: z.string().min(1, 'Location is required'),
    weatherConditions: z.string().max(500, 'At most 500 characters'),
    notes: z.string().max(1000, 'At most 1000 characters'),
    publishAfterSave: z.boolean(),
    catches: z.array(catchSchema),
  })
  // FR-6: start and end time are part of a trip. The end can follow later while still fishing.
  // Without an end date, an end earlier than the start means the session ran past midnight.
  .superRefine((v, ctx) => {
    if (!v.endTime && !v.stillFishing)
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: 'End time is required (or tick "Still fishing")' });
    if (!v.endTime && v.stillFishing && v.tripDate < addDaysToDate(todayLocal(), -(MAX_TRIP_DAYS - 1)))
      ctx.addIssue({ code: 'custom', path: ['endTime'], message: `A trip can last up to ${MAX_TRIP_DAYS} days — add the end time` });
    if (v.multiDay && !v.stillFishing) {
      if (!v.endDate)
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'End date is required' });
      else if (v.endDate <= v.tripDate)
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Must be after the start date' });
      else if (v.endDate > addDaysToDate(v.tripDate, MAX_TRIP_DAYS - 1))
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: `Up to ${MAX_TRIP_DAYS} days` });
      else if (v.endDate > todayLocal())
        ctx.addIssue({ code: 'custom', path: ['endDate'], message: 'Can\'t be in the future' });
    }
  });

type TripFormValues = z.infer<typeof tripFormSchema>;
type CatchValues = z.infer<typeof catchSchema>;

const emptyCatch: CatchValues = {
  speciesId: '', weight: '', length: '', gearUsed: '', baitUsed: '', fishingMethod: '', notes: '', day: '',
};

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toCatchPayload(c: CatchValues, tripDate: string, days: string[]): CreateCatchPayload {
  // A day that no longer belongs to the trip (dates changed after picking it) falls back to day 1.
  const day = c.day && days.includes(c.day) ? c.day : tripDate;
  return {
    speciesId: c.speciesId,
    locationId: null, // uses the trip's location; a different spot per catch can be set when editing the catch
    catchDate: new Date(day).toISOString(),
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
  const categories = useCatchCategories();
  const { user } = useAuth();
  const { online } = useOfflineStatus();

  const form = useForm<TripFormValues>({
    resolver: zodResolver(tripFormSchema),
    defaultValues: {
      title: '',
      tripDate: todayLocal(),
      startTime: '',
      endTime: '',
      stillFishing: false,
      multiDay: false,
      endDate: '',
      locationId: '',
      weatherConditions: '',
      notes: '',
      publishAfterSave: false,
      catches: isEdit ? [] : [emptyCatch],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'catches' });
  const [watchedLocation, watchedDate, watchedStart, watchedEnd, watchedStillFishing, watchedMultiDay, watchedEndDate] = useWatch({
    control: form.control,
    name: ['locationId', 'tripDate', 'startTime', 'endTime', 'stillFishing', 'multiDay', 'endDate'],
  });
  const today = todayLocal();
  const isToday = watchedDate === today;
  // Still fishing: for a trip started within the last 7 days (camping and offshore trips run on).
  const canStillFish = !!watchedDate && watchedDate >= addDaysToDate(today, -(MAX_TRIP_DAYS - 1)) && watchedDate <= today;
  const effectiveEndDate = watchedMultiDay && !watchedStillFishing && watchedEndDate > watchedDate ? watchedEndDate : null;

  // Same rule as the API, so the preview shows exactly what gets saved.
  const moments = conditionMoments(watchedDate, effectiveEndDate, watchedStart, watchedStillFishing ? '' : watchedEnd);
  // Multi-day preview: one tab per saved day. Clamp in case the trip got shorter.
  const [previewDay, setPreviewDay] = useState(0);
  const dayIndex = Math.min(previewDay, Math.max(moments.length - 1, 0));
  const moment = moments[dayIndex];

  // Days a catch can be dated: the whole trip (so far, while still fishing).
  const lastDay = watchedStillFishing
    ? (watchedMultiDay ? (today < addDaysToDate(watchedDate, MAX_TRIP_DAYS - 1) ? today : addDaysToDate(watchedDate, MAX_TRIP_DAYS - 1)) : watchedDate)
    : lastTripDay(watchedDate, effectiveEndDate, watchedStart, watchedEnd);
  const days = watchedDate ? tripDays(watchedDate, lastDay < watchedDate ? watchedDate : lastDay) : [];
  const dayLabel = (d: string, i: number) =>
    `Day ${i + 1} · ${new Date(`${d}T00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;

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
          stillFishing: !t.endTime,
          multiDay: !!t.endDate,
          endDate: t.endDate ?? '',
          locationId: t.locationId ?? '',
          weatherConditions: t.weatherConditions ?? '',
          notes: t.notes ?? '',
          publishAfterSave: false,
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
      stillFishing: values.stillFishing && !values.endTime,
      endDate: values.multiDay && !values.stillFishing && values.endDate ? values.endDate : null,
      locationId: values.locationId || null,
      notes: values.notes || null,
      weatherConditions: values.weatherConditions || null,
    };

    try {
      if (isEdit) {
        await tripsApi.update(id!, tripPayload);
        navigate(`/trips/${id}`);
        return;
      }

      // New trips go through the device's upload queue (F-13): saved here first, with photos and
      // videos, then uploaded trip → catches → files. Online that happens right away; offline it waits.
      const entry: OutboxEntry = {
        id: newId(),
        userId: user!.id,
        createdAt: 0, // stamped by outbox.add
        trip: tripPayload,
        locationName: locations.find((l) => l.id === values.locationId)?.name ?? null,
        publishAfterSave: values.publishAfterSave,
        status: 'pending',
        catches: values.catches.map((c, i) => ({
          clientId: newId(),
          payload: toCatchPayload(c, values.tripDate, days),
          media: (photos[fields[i].id] ?? []).map((file) => ({
            clientId: newId(),
            file,
            name: file.name,
            type: file.type,
            uploaded: false,
          })),
        })),
      };

      try {
        await outbox.add(entry);
      } catch {
        form.setError('root', { message: "Couldn't save on this device (storage full or blocked). Free some space or try online." });
        return;
      }

      const result = await syncOne(entry.id);
      if (result.state === 'offline') {
        toast.success('Trip saved on this device.', {
          description: "It will upload by itself when you're back online.",
        });
        navigate('/trips');
        return;
      }
      if (result.state === 'failed') {
        // The server refused the trip itself (e.g. the location was removed): fix it here.
        await outbox.remove(entry.id);
        form.setError('root', { message: result.error });
        return;
      }
      if (result.state === 'attention') {
        // The trip exists; send the angler there to finish what didn't go through.
        await outbox.remove(entry.id);
        navigate(`/trips/${result.tripId}`, { state: { warning: `Trip saved, but not every catch or photo was: ${result.error}` } });
        return;
      }

      // "Upload now" (FR-43): open the publish preview straight away; publishing still needs the angler's OK (FR-45).
      navigate(`/trips/${result.tripId}`, { state: values.publishAfterSave ? { openPublish: true } : undefined });
    } catch (err) {
      form.setError('root', { message: errorMessage(err) });
    }
  };

  const speciesItems = species.map((s) => ({ value: s.id, label: s.commonName }));

  return (
    <div className="mx-auto max-w-3xl">
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

              <div className={watchedMultiDay && !watchedStillFishing ? 'grid grid-cols-2 gap-4 sm:grid-cols-4' : 'grid grid-cols-3 gap-4'}>
                <FormField
                  control={form.control}
                  name="tripDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{watchedMultiDay ? 'Start date *' : 'Date *'}</FormLabel>
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
                      <FormLabel>Start *</FormLabel>
                      <FormControl><Input type="time" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {watchedMultiDay && !watchedStillFishing && (
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End date *</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            min={watchedDate ? addDaysToDate(watchedDate, 1) : undefined}
                            max={watchedDate && addDaysToDate(watchedDate, MAX_TRIP_DAYS - 1) < today ? addDaysToDate(watchedDate, MAX_TRIP_DAYS - 1) : today}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{watchedMultiDay ? 'End time' : 'End'} {watchedStillFishing ? '' : '*'}</FormLabel>
                      <FormControl><Input type="time" disabled={watchedStillFishing} {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="-mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                {isToday && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => form.setValue('startTime', nowTimeInput(), { shouldDirty: true, shouldValidate: true })}
                  >
                    Start now
                  </Button>
                )}
                <FormField
                  control={form.control}
                  name="multiDay"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked === true);
                            if (checked !== true) form.setValue('endDate', '');
                            form.trigger(['endDate', 'endTime']);
                          }}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0 font-normal">Multi-day trip (camping, offshore)</FormLabel>
                    </FormItem>
                  )}
                />
                {canStillFish && (
                  <FormField
                    control={form.control}
                    name="stillFishing"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={(checked) => {
                              field.onChange(checked === true);
                              if (checked === true) {
                                form.setValue('endTime', '');
                                form.setValue('endDate', '');
                              }
                              form.trigger(['endTime', 'endDate']);
                            }}
                          />
                        </FormControl>
                        <FormLabel className="!mt-0 font-normal">Still fishing (add the end time later)</FormLabel>
                      </FormItem>
                    )}
                  />
                )}
                <span className="text-xs text-muted-foreground">
                  {watchedMultiDay
                    ? watchedStillFishing
                      ? 'Add the end date and time when you\'re back.'
                      : `Up to ${MAX_TRIP_DAYS} days. Weather, moon and tides are saved for each day.`
                    : 'Ending after midnight? Just enter the time; it counts as the next morning.'}
                </span>
              </div>

              <FormField
                control={form.control}
                name="locationId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location *</FormLabel>
                    <Select
                      items={[
                        ...locations.map((l) => ({ value: l.id, label: l.name })),
                        { value: ADD_NEW_LOCATION, label: '+ Add new location' },
                      ]}
                      value={field.value || null}
                      onValueChange={(v) => {
                        if (v === ADD_NEW_LOCATION) {
                          setQuickAddOpen(true);
                          return;
                        }
                        field.onChange(v ?? '');
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Choose a location" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
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

              {watchedLocation && !online && (
                <p className="m-0 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                  You're offline. Weather, moon and tides will be added when the trip uploads.
                </p>
              )}
              {watchedLocation && online && (
                // Weather, moon and tides are saved with the trip for the middle of the session (FR-16).
                watchedStart && watchedDate && moment ? (
                  <div className="space-y-2">
                    {moments.length > 1 && (
                      <div>
                        <p className="m-0 mb-1.5 text-xs text-muted-foreground">
                          Conditions are saved for each of the {moments.length} days, at the middle of the hours fished that day.
                        </p>
                        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Preview day">
                          {moments.map((m, i) => (
                            <button
                              key={m.date}
                              type="button"
                              role="tab"
                              aria-selected={i === dayIndex}
                              onClick={() => setPreviewDay(i)}
                              className={
                                i === dayIndex
                                  ? 'rounded-md bg-primary px-2.5 py-1 text-xs text-primary-foreground'
                                  : 'rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground'
                              }
                            >
                              {dayLabel(m.date, days.indexOf(m.date) >= 0 ? days.indexOf(m.date) : i)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    <ConditionsPanel
                      query={{ locationId: watchedLocation, date: moment.date, time: moment.time }}
                      title={
                        moments.length > 1
                          ? `Day ${(days.indexOf(moment.date) >= 0 ? days.indexOf(moment.date) : dayIndex) + 1} at ${to12h(moment.time)}`
                          : watchedEnd && !watchedStillFishing && moment.time !== watchedStart
                            ? `Conditions mid-session (${to12h(moment.time)}${moment.date !== watchedDate ? ', next day' : ''}), saved with the trip`
                            : 'Conditions at your start time, saved with the trip'
                      }
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Set your start time to see the conditions for your session.</p>
                )
              )}

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

                      {days.length > 1 && (
                        <FormField
                          control={form.control}
                          name={`catches.${index}.day`}
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Caught on</FormLabel>
                              <FormControl>
                                <select
                                  className="h-10 w-full border-b border-input bg-transparent text-sm outline-none"
                                  value={field.value && days.includes(field.value) ? field.value : days[0]}
                                  onChange={(e) => field.onChange(e.target.value)}
                                >
                                  {days.map((d, i) => <option key={d} value={d}>{dayLabel(d, i)}</option>)}
                                </select>
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      )}

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
                            <RequestSpeciesLink />
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
                                <CategorySelect
                                  value={field.value}
                                  onChange={field.onChange}
                                  options={name === 'gearUsed' ? categories.gear : name === 'baitUsed' ? categories.bait : categories.method}
                                />
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
                        <FormLabel>Photos & videos</FormLabel>
                        <MediaPicker
                          idPrefix={`catch-${row.id}`}
                          files={photos[row.id] ?? []}
                          onChange={(files) => setPhotos((prev) => ({ ...prev, [row.id]: files }))}
                          maxCount={MAX_MEDIA_PER_CATCH}
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

              {!isEdit && (
                <FormField
                  control={form.control}
                  name="publishAfterSave"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!mt-0 font-normal">
                        Publish after saving (you'll see what others will see first). Otherwise it stays private.
                      </FormLabel>
                    </FormItem>
                  )}
                />
              )}

              {form.formState.errors.root && (
                <p className="text-sm text-destructive" role="alert">
                  {form.formState.errors.root.message}
                </p>
              )}

              {!isEdit && !online && (
                <p className="m-0 text-sm text-muted-foreground">
                  You're offline: the trip, its catches and photos/videos will be saved on this device and upload
                  automatically when you're back online.
                </p>
              )}

              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting} className="flex-1">
                  {form.formState.isSubmitting ? 'Saving...' : !isEdit && !online ? 'Save on this device' : 'Save trip'}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
