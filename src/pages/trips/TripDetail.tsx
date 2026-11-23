import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Heart, Lock, Globe, Plus, RefreshCw, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { tripsApi } from '../../api/trips';
import { catchesApi } from '../../api/catches';
import type { Trip } from '../../types/trip';
import type { Catch } from '../../types/catch';
import { useAuth } from '../../context/useAuth';
import { useTripLike } from '../../hooks/useTripLike';
import { CastDivider } from '../../components/CastDivider';
import { resolveMediaUrl } from '../../utils/mediaUrl';
import { formatTripDates, timeRange, tripHeading } from '../../utils/trip';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CommentSection } from '../../components/CommentSection';
import { ShareButton } from '../../components/ShareButton';
import { PublishDialog } from '../../components/PublishDialog';
import { LocationMiniMap } from '../../components/map/LocationMiniMap';
import { hasPosition } from '../../components/map/leaflet';

function CatchBlock({ item, isOwner, tripLocationId, onDeleted }: {
  item: Catch;
  isOwner: boolean;
  tripLocationId: string | null;
  onDeleted: (id: string) => void;
}) {
  const media = [...item.media].sort((a, b) => a.orderIndex - b.orderIndex);

  const handleDelete = async () => {
    if (!confirm('Remove this catch from the trip?')) return;
    try {
      await catchesApi.remove(item.id);
      onDeleted(item.id);
    } catch {
      toast.error("Couldn't remove this catch — try again.");
    }
  };

  return (
    <div id={`catch-${item.id}`} className="rounded-lg border border-border p-3">
      {media.length > 0 && (
        <div className="mb-3 flex gap-2 overflow-x-auto">
          {media.map((m) =>
            m.mediaType === 'Video' ? (
              <video key={m.id} src={resolveMediaUrl(m.mediaUrl)} controls className="h-45" />
            ) : (
              <img key={m.id} src={resolveMediaUrl(m.mediaUrl)} alt={item.speciesName ?? 'Catch photo'} className="h-45" />
            )
          )}
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
function ConditionsLine({ label, text }: { label: string; text: string }) {
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

  // "Publish after saving" from the trip form opens the preview once (FR-43, FR-45).
  const [publishOpen, setPublishOpen] = useState(() => openPublish && isOwner && !trip.isPublic);
  useEffect(() => {
    // Clear the one-time flag so a refresh or Back doesn't reopen the dialog.
    if (openPublish) navigate(location.pathname + location.hash, { replace: true, state: null });
  }, [openPublish, navigate, location.pathname, location.hash]);

  const [withdrawing, setWithdrawing] = useState(false);
  const handleWithdraw = async () => {
    if (!confirm('Withdraw this trip? It becomes private again and leaves the community feed.')) return;
    setWithdrawing(true);
    try {
      onChange(await tripsApi.unpublish(trip.id));
      toast.success('Trip withdrawn — it is private again.');
    } catch {
      toast.error("Couldn't withdraw this trip — try again.");
    } finally {
      setWithdrawing(false);
    }
  };

  const showMap = trip.locationLatitude != null && trip.locationLongitude != null
    && hasPosition(trip.locationLatitude, trip.locationLongitude);

  const handleDelete = async () => {
    // Soft delete: the trip and its catches are hidden, and an administrator can restore them from a backup.
    if (!confirm('Delete this trip and all its catches?')) return;
    try {
      await tripsApi.remove(trip.id);
      navigate('/trips');
    } catch {
      toast.error("Couldn't delete this trip — try again.");
    }
  };

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
              <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                {trip.isPublic ? <Globe className="size-3.5" /> : <Lock className="size-3.5" />}
                {trip.isPublic ? 'Published' : 'Private'}
                {trip.isPublic && trip.disclosesPrivateLocations && ' · spot shown'}
              </span>
            )}
          </div>

          {isOwner && (
            <div className="mt-3 flex flex-wrap gap-2">
              {trip.isPublic ? (
                <>
                  <Button variant="outline" size="sm" onClick={() => setPublishOpen(true)}>Change location visibility</Button>
                  <Button variant="outline" size="sm" onClick={handleWithdraw} disabled={withdrawing}>
                    {withdrawing ? 'Withdrawing…' : 'Withdraw'}
                  </Button>
                </>
              ) : (
                <Button size="sm" onClick={() => setPublishOpen(true)}><Globe className="size-4" /> Publish…</Button>
              )}
            </div>
          )}

          <h1 className="mt-3 font-heading text-2xl">{tripHeading(trip)}</h1>
          <CastDivider />

          <p className="text-muted-foreground">
            📍 {trip.locationHidden ? 'Location hidden by the angler' : trip.locationName ?? 'No location'} &nbsp;·&nbsp; 📅 {formatTripDates(trip)}
            {times && <> &nbsp;·&nbsp; 🕒 {times}</>}
          </p>
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
            {trip.catches.length === 0 && (
              <p className="text-sm text-muted-foreground">No catches logged on this trip.</p>
            )}
            {trip.catches.map((c) => (
              <CatchBlock
                key={c.id}
                item={c}
                isOwner={isOwner}
                tripLocationId={trip.locationId}
                onDeleted={handleCatchDeleted}
              />
            ))}
          </div>

          {isOwner && (
            <Link to={`/trips/${trip.id}/catches/new`} className="mt-3 inline-block">
              <Button variant="outline"><Plus className="size-4" /> Add a catch</Button>
            </Link>
          )}

          <div className="mt-4 flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={toggleLike}
              disabled={busy}
              className="h-auto gap-1.5 p-0 text-sm normal-case tracking-normal text-brass hover:bg-transparent"
            >
              <Heart className={liked ? 'fill-rust text-rust' : 'text-brass'} />
              {likeCount} likes
            </Button>

            <ShareButton
              tripId={trip.id}
              className="h-auto gap-1.5 p-0 text-sm normal-case tracking-normal text-muted-foreground hover:bg-transparent hover:text-foreground"
            />
          </div>

          <CommentSection tripId={trip.id} />

          {isOwner && (
            <div className="mt-4 flex gap-3">
              <Link to={`/trips/${trip.id}/edit`}>
                <Button variant="outline">Edit trip</Button>
              </Link>
              <Button variant="destructive" onClick={handleDelete}>Delete trip</Button>
            </div>
          )}
        </CardContent>
      </Card>

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
  }, [id]);

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
