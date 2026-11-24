import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Heart, Lock, Globe, Plus, RefreshCw, EyeOff, Fish, CloudUpload, Play } from 'lucide-react';
import { toast } from 'sonner';
import { isOfflineError } from '../../api/client';
import { tripsApi } from '../../api/trips';
import { catchesApi } from '../../api/catches';
import type { Trip } from '../../types/trip';
import type { Catch } from '../../types/catch';
import { useAuth } from '../../context/useAuth';
import { useTripLike } from '../../hooks/useTripLike';
import { CastDivider } from '../../components/CastDivider';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { formatTripDates, isStillFishing, timeRange, tripHeading } from '../../utils/trip';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CommentSection } from '../../components/CommentSection';
import { ShareButton } from '../../components/ShareButton';
import { PublishDialog } from '../../components/PublishDialog';
import { ReportButton } from '../../components/ReportDialog';
import { LocationMiniMap } from '../../components/map/LocationMiniMap';
import { hasPosition } from '../../components/map/leaflet';
import { TripOwnerMenu } from '../../components/TripOwnerMenu';
import { useConfirm } from '../../hooks/useConfirm';
import { to12h } from '../../utils/time';
import { QuickCatchDialog } from '../../components/QuickCatchDialog';
import { MediaViewer } from '../../components/MediaViewer';
import { TripStatusBadge } from '../../components/TripStatusBadge';
import { setPageTitle } from '../../hooks/usePageTitle';
import { tripViewerItems } from '../../utils/viewer';
import { pendingCatchesFor, useOutbox } from '../../offline/outbox';
import { catchDraftTarget, useCatchDrafts } from '../../offline/drafts';

function CatchBlock({ item, isOwner, tripLocationId, onDeleted, onOpenMedia }: {
  item: Catch;
  isOwner: boolean;
  tripLocationId: string | null;
  onDeleted: (id: string) => void;
  /** Opens the full-screen viewer at this photo/video. */
  onOpenMedia: (mediaId: string) => void;
}) {
  const media = [...item.media].sort((a, b) => a.orderIndex - b.orderIndex);
  const ask = useConfirm();

  const handleDelete = async () => {
    if (!(await ask({ title: 'Remove this catch from the trip?', description: 'You can undo this right after.', confirmLabel: 'Remove', destructive: true }))) return;
    try {
      await catchesApi.remove(item.id);
      onDeleted(item.id);
    } catch (err) {
      toast.error(isOfflineError(err) ? "Couldn't remove, no connection." : "Couldn't remove this catch — try again.");
    }
  };

  return (
    <div id={`catch-${item.id}`} className="rounded-lg border border-border p-3">
      {media.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {media.map((m, i) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onOpenMedia(m.id)}
              aria-label={`Open ${m.mediaType === 'Video' ? 'video' : 'photo'} ${i + 1} of ${media.length} full screen`}
              className="relative shrink-0 cursor-zoom-in overflow-hidden rounded-md focus-visible:outline-2 focus-visible:outline-ring"
            >
              {m.mediaType === 'Video' ? (
                <>
                  <video src={resolveMediaUrl(m.mediaUrl)} muted preload="metadata" className="h-45 pointer-events-none" />
                  <span className="absolute inset-0 flex items-center justify-center bg-black/25">
                    <Play className="size-10 fill-white text-white drop-shadow" />
                  </span>
                </>
              ) : (
                <img src={resolveMediaUrl(m.mediaUrl)} alt={item.speciesName ?? 'Catch photo'} className="h-45" />
              )}
            </button>
          ))}
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <div>
          <strong className="text-base">{item.speciesName ?? 'Unknown species'}</strong>
          <p className="m-0 font-mono text-sm">
            {item.weight != null ? `${item.weight} kg` : '—'} · {item.length != null ? `${item.length} cm` : '—'}
          </p>
        </div>
        {isOwner && (
          <div className="flex shrink-0 gap-2">
            <Link to={`/catches/${item.id}/edit`}><Button variant="outline" size="sm">Edit</Button></Link>
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-muted-foreground hover:text-destructive">
              Remove
            </Button>
          </div>
        )}
      </div>

      {item.locationId && item.locationId !== tripLocationId && item.locationName && (
        <p className="m-0 text-sm text-muted-foreground">📍 {item.locationName}</p>
      )}
      {item.locationHidden && (
        <p className="m-0 flex items-center gap-1 text-sm text-muted-foreground"><EyeOff className="size-3.5" /> Location hidden</p>
      )}
      {item.gearUsed && <p className="m-0 text-sm"><strong>Gear:</strong> {item.gearUsed}</p>}
      {item.baitUsed && <p className="m-0 text-sm"><strong>Bait:</strong> {item.baitUsed}</p>}
      {item.fishingMethod && <p className="m-0 text-sm"><strong>Method:</strong> {item.fishingMethod}</p>}
      {item.notes && <p className="m-0 text-sm"><strong>Notes:</strong> {item.notes}</p>}
    </div>
  );
}

/** One conditions field; a multi-day trip stores one "Sat, Nov 22: …" line per day. */
function ConditionsLine({ label, text: raw }: { label: string; text: string }) {
  // Older snapshots were saved with 24-hour times ("15:12"); show every time as AM/PM.
  const text = raw.replace(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s?[AP]M)/g, (t) => to12h(t));
  const lines = text.split('\n').filter(Boolean);
  if (lines.length <= 1) return <p className="m-0"><strong>{label}:</strong> {text}</p>;
  return (
    <div>
      <strong>{label}:</strong>
      <ul className="m-0 list-none space-y-0.5 p-0 pl-3">
        {lines.map((line) => {
          const split = line.indexOf(': ');
          return (
            <li key={line}>
              {split > 0 ? <><span className="font-medium">{line.slice(0, split)}</span>{line.slice(split)}</> : line}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function TripView({ trip, onChange, openPublish }: { trip: Trip; onChange: (t: Trip) => void; openPublish: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { liked, likeCount, busy, toggleLike } = useTripLike(trip);
  const isOwner = user?.id === trip.userId;
  const times = timeRange(trip);
  const heading = tripHeading(trip);
  useEffect(() => { setPageTitle(heading); }, [heading]);
  const stillFishing = isOwner && isStillFishing(trip);
  const [quickOpen, setQuickOpen] = useState(false);
  const hasCatchDraft = useCatchDrafts(user?.id);
  const catchLabel = hasCatchDraft(catchDraftTarget.saved(trip.id)) ? 'Continue catch' : 'Quick catch';
  const viewerItems = tripViewerItems(trip);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const { entries } = useOutbox();
  const waiting = isOwner ? pendingCatchesFor(entries, trip.id) : [];

  // "Publish after saving" from the trip form opens the preview once (FR-43, FR-45).
  const [publishOpen, setPublishOpen] = useState(() => openPublish && isOwner && !trip.isPublic);
  useEffect(() => {
    // Clear the one-time flag so a refresh or Back doesn't reopen the dialog.
    if (openPublish) navigate(location.pathname + location.hash, { replace: true, state: null });
  }, [openPublish, navigate, location.pathname, location.hash]);

  const showMap = trip.locationLatitude != null && trip.locationLongitude != null
    && hasPosition(trip.locationLatitude, trip.locationLongitude);

  const [refreshing, setRefreshing] = useState(false);
  const handleRefreshConditions = async () => {
    setRefreshing(true);
    try {
      onChange(await tripsApi.refreshConditions(trip.id));
      toast.success('Conditions updated.');
    } catch {
      toast.error("Couldn't refresh conditions — try again later.");
    } finally {
      setRefreshing(false);
    }
  };

  const handleCatchDeleted = (catchId: string) => {
    const catches = trip.catches.filter((c) => c.id !== catchId);
    onChange({ ...trip, catches, catchCount: catches.length });
    // Undo (B-24): the delete is soft, so it can be reversed.
    toast('Catch removed.', {
      duration: 8000,
      action: {
        label: 'Undo',
        onClick: async () => {
          try {
            await catchesApi.restore(catchId);
            onChange(await tripsApi.getById(trip.id));
          } catch {
            toast.error("Couldn't undo — try again from the trip later.");
          }
        },
      },
    });
  };

  return (
    <div className="mx-auto max-w-4xl">
      <Card>
        <CardContent>
          <Link to={isOwner ? '/trips' : '/feed'} className="text-sm text-muted-foreground hover:text-foreground">
            ← Back
          </Link>

          <div className="mt-3 flex items-center gap-2">
            <Link to={`/anglers/${trip.userId}`} className="flex items-center gap-2 text-foreground no-underline">
              {trip.userAvatarUrl ? (
                <img src={resolveMediaUrl(trip.userAvatarUrl)} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted" />
              )}
              <strong className="text-sm">{trip.userFullName ?? 'Angler'}</strong>
            </Link>
            {isOwner && (
              <div className="ml-auto flex items-center gap-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  {trip.isPublic ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
                  {trip.isPublic ? 'Published' : 'Private'}
                  {trip.isPublic && trip.disclosesPrivateLocations && ' · spot shown'}
                </span>
                <TripOwnerMenu trip={trip} onChange={onChange} onDeleted={() => navigate('/trips')} />
              </div>
            )}
          </div>

          {isOwner && trip.removedFromCommunity && (
            <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm">
              An administrator removed this trip from the community
              {trip.moderationReason ? <>: <strong>{trip.moderationReason}</strong></> : ''}. It stays in your journal
              as a private trip and can't be published again.
            </p>
          )}
          {isOwner && !trip.removedFromCommunity && !trip.isPublic && (
            <div className="mt-3">
              <Button size="sm" onClick={() => setPublishOpen(true)}><Globe className="size-4" /> Publish…</Button>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
            <h1 className="m-0 font-heading text-2xl">{tripHeading(trip)}</h1>
            <TripStatusBadge trip={trip} isOwner={isOwner} editHref={`/trips/${trip.id}/edit`} />
          </div>
          <CastDivider />

          <p className="text-muted-foreground">
            📍 {trip.locationHidden ? 'Location hidden by the angler' : trip.locationName ?? 'No location'}
            {trip.locationDeleted && isOwner && <span className="text-xs"> (removed from your spots)</span>}
            {' '}&nbsp;·&nbsp; 📅 {formatTripDates(trip)}
            {times && <> &nbsp;·&nbsp; 🕒 {times}</>}
          </p>
          {stillFishing && (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--color-brass)]/40 bg-muted/40 p-3">
              <span className="text-sm">🎣 Still fishing? Log each catch as it lands, even with no signal.</span>
              <Button size="sm" className="ml-auto" onClick={() => setQuickOpen(true)}><Fish className="size-4" /> {catchLabel}</Button>
            </div>
          )}
          {isOwner && !trip.endTime && (
            <p className="text-sm">
              No end time yet.{' '}
              <Link to={`/trips/${trip.id}/edit`} className="underline">Add it when you finish</Link>
              {' '}so the conditions cover your whole session.
            </p>
          )}
          {showMap && <LocationMiniMap lat={trip.locationLatitude!} lng={trip.locationLongitude!} />}
          {trip.notes && <p><strong>Notes:</strong> {trip.notes}</p>}

          {(trip.weatherConditions || trip.lunarConditions || trip.tidalConditions || isOwner) && (
            <div className="mt-4 rounded-lg border border-border p-3 text-sm">
              <div className="mb-1 flex items-center justify-between gap-2">
                <strong>Conditions when logged</strong>
                {isOwner && trip.locationId && (
                  <Button variant="ghost" size="sm" onClick={handleRefreshConditions} disabled={refreshing} className="px-2">
                    <RefreshCw className="size-4" /> {refreshing ? 'Refreshing…' : 'Refresh'}
                  </Button>
                )}
              </div>
              <ConditionsLine label="Weather" text={trip.weatherConditions ?? '—'} />
              <ConditionsLine label="Moon" text={trip.lunarConditions ?? '—'} />
              <ConditionsLine label="Tides" text={trip.tidalConditions ?? (trip.locationId ? '—' : 'Add a location to get tides.')} />
              {trip.locationId && (
                <p className="m-0 mt-1 text-xs text-muted-foreground">
                  Data: <a href="https://open-meteo.com/" target="_blank" rel="noreferrer" className="underline">Open-Meteo.com</a> (CC BY 4.0) · Moon: SunCalc. Tides are model estimates, not for navigation.
                </p>
              )}
            </div>
          )}

          <h2 className="mt-6 font-heading text-lg">
            Catches {trip.catches.length > 0 && `(${trip.catches.length})`}
          </h2>
          <div className="mt-2 flex flex-col gap-3">
            {waiting.map((e) => (
              <div key={e.id} className="flex items-center gap-2 rounded-lg border border-dashed border-border p-3 text-sm text-muted-foreground">
                <CloudUpload className="size-4 shrink-0" />
                <span>
                  A catch saved on this device {e.status === 'attention' || e.status === 'failed' ? 'needs attention — see My Trips.' : 'is waiting to upload.'}
                </span>
              </div>
            ))}
            {trip.catches.length === 0 && waiting.length === 0 && (
              <p className="text-sm text-muted-foreground">No catches logged on this trip.</p>
            )}
            {trip.catches.map((c) => (
              <CatchBlock
                key={c.id}
                item={c}
                isOwner={isOwner}
                tripLocationId={trip.locationId}
                onDeleted={handleCatchDeleted}
                onOpenMedia={(mediaId) => setViewerIndex(Math.max(0, viewerItems.findIndex((v) => v.id === mediaId)))}
              />
            ))}
          </div>

          {isOwner && (
            <div className="mt-3 flex flex-wrap gap-2">
              {stillFishing && (
                <Button onClick={() => setQuickOpen(true)}><Fish className="size-4" /> {catchLabel}</Button>
              )}
              <Link to={`/trips/${trip.id}/catches/new`}>
                <Button variant="outline"><Plus className="size-4" /> {stillFishing ? 'Full catch form' : 'Add a catch'}</Button>
              </Link>
            </div>
          )}

          <div className="mt-4 flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={toggleLike}
              disabled={busy} aria-pressed={liked}
              aria-label={`${liked ? 'Unlike' : 'Like'} this trip, ${likeCount} ${likeCount === 1 ? 'like' : 'likes'}`}
              className="h-auto gap-1.5 p-0 text-sm normal-case tracking-normal text-brass hover:bg-transparent"
            >
              <Heart aria-hidden="true" className={liked ? 'fill-rust text-rust' : 'text-brass'} />
              {likeCount} likes
            </Button>

            <ShareButton
              tripId={trip.id}
              className="h-auto gap-1.5 p-0 text-sm normal-case tracking-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
            />

            {!isOwner && trip.isPublic && (
              <ReportButton
                targetType="Trip"
                targetId={trip.id}
                className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-destructive"
              />
            )}
          </div>

          <div id="comments">
            <CommentSection tripId={trip.id} canReport={trip.isPublic} />
          </div>

        </CardContent>
      </Card>

      <MediaViewer items={viewerItems} index={viewerIndex} onIndexChange={setViewerIndex} onClose={() => setViewerIndex(null)} />
      {stillFishing && (
        <QuickCatchDialog
          target={{ kind: 'saved', trip }}
          open={quickOpen}
          onOpenChange={setQuickOpen}
          onSaved={() => { void tripsApi.getById(trip.id).then(onChange).catch(() => {}); }}
        />
      )}
      {isOwner && (
        <PublishDialog
          tripId={trip.id}
          open={publishOpen}
          onOpenChange={setPublishOpen}
          onPublished={(t) => {
            onChange(t);
            toast.success('Trip published to the community feed.');
          }}
        />
      )}
    </div>
  );
}

export function TripDetail() {
  const { id } = useParams();
  const location = useLocation();
  // Result tagged with the id it belongs to, so switching trips shows "Loading" without
  // resetting state inside the effect.
  const [loaded, setLoaded] = useState<{ id: string; trip?: Trip; error?: string } | null>(null);
  // A quick catch queued offline landed: show it.
  const { uploadedVersion } = useOutbox();

  useEffect(() => {
    const warning = (location.state as { warning?: string } | null)?.warning;
    if (warning) toast.warning(warning);
  }, [location.state]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    tripsApi.getById(id)
      .then((trip) => { if (!cancelled) setLoaded({ id, trip }); })
      .catch((err) => {
        if (cancelled) return;
        setLoaded({ id, error: err?.status === 401 ? 'Please log in to view this trip.' : 'Trip not found.' });
      });
    return () => { cancelled = true; };
  }, [id, uploadedVersion]);

  const current = loaded && loaded.id === id ? loaded : null;
  const trip = current?.trip ?? null;

  // Links like /trips/{id}#catch-{catchId} (from My Catches) scroll to that catch once loaded.
  const hasTrip = !!trip;
  useEffect(() => {
    if (!hasTrip || !location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [hasTrip, location.hash]);

  if (current?.error) return <p className="text-sm text-destructive">{current.error}</p>;
  if (!trip) return <p className="text-muted-foreground">Loading...</p>;

  // Keyed by id so the like state resets when navigating between trips.
  const openPublish = !!(location.state as { openPublish?: boolean } | null)?.openPublish;
  return <TripView key={trip.id} trip={trip} openPublish={openPublish} onChange={(t) => setLoaded({ id: t.id, trip: t })} />;
}
