import { Link } from 'react-router-dom';
import { useState } from 'react';
import { Heart, MessageCircle, Fish, MoreHorizontal, Flag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Trip } from '../types/trip';
import { useTripLike } from '../hooks/useTripLike';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { formatTripDates, timeRange, tripCoverMedia, tripHeading } from '../utils/trip';
import { Card, CardContent } from './ui/card';
import { Button } from './ui/button';
import { PostDialog } from './PostDialog';
import { ShareButton } from './ShareButton';
import { ReportDialog } from './ReportDialog';
import { useAuth } from '../context/useAuth';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { TripOwnerMenu } from './TripOwnerMenu';

export function TripCard({ item: initial }: { item: Trip }) {
  const [item, setItem] = useState(initial);
  // Withdrawn or deleted from this card: it no longer belongs in a feed of published trips.
  const [gone, setGone] = useState(false);
  const { liked, likeCount, busy, toggleLike } = useTripLike(item);
  const [commentCount, setCommentCount] = useState(item.commentCount ?? 0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const { user } = useAuth();
  // Facebook-style "⋯" on someone else's published trip (F-18).
  const canReport = item.isPublic && !!user && user.id !== item.userId;
  const isOwner = !!user && user.id === item.userId;

  const cover = tripCoverMedia(item);
  const postedAt = item.publishedAt ?? item.createdAt;
  const times = timeRange(item);

  if (gone) return null;

  return (
    <>
      <Card className="overflow-hidden py-0 gap-0">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <Link to={`/anglers/${item.userId}`} className="flex items-center gap-2 text-foreground no-underline">
              {item.userAvatarUrl ? (
                <img src={resolveMediaUrl(item.userAvatarUrl)} alt="" className="w-8 h-8 rounded-full object-cover" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted" />
              )}
              <strong className="text-sm">{item.userFullName ?? 'Angler'}</strong>
            </Link>
            <div className="flex items-center gap-1">
              <span className="text-mono text-xs text-muted-foreground" title={new Date(postedAt).toLocaleString()}>
                {formatDistanceToNow(new Date(postedAt), { addSuffix: true })}
              </span>
              {isOwner && (
                <TripOwnerMenu
                  trip={item}
                  className="-mr-1"
                  onChange={(t) => (t.isPublic ? setItem(t) : setGone(true))}
                  onDeleted={() => setGone(true)}
                />
              )}
              {canReport && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label="More options"
                    className="-mr-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <MoreHorizontal className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setReporting(true)}>
                      <Flag /> Report trip
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {cover && cover.mediaType === 'Video' ? (
            <video
              src={resolveMediaUrl(cover.mediaUrl)}
              controls
              className="w-full h-auto max-h-[32rem] rounded-lg mb-3 bg-muted"
            />
          ) : cover ? (
            <img
              src={resolveMediaUrl(cover.mediaUrl)}
              alt={tripHeading(item)}
              className="w-full h-auto max-h-[32rem] object-contain rounded-lg mb-3 bg-muted"
            />
          ) : null}

          <Link
            to={`/trips/${item.id}`}
            className="text-foreground no-underline transition-colors hover:text-brass hover:underline"
          >
            <strong>{tripHeading(item)}</strong>
          </Link>
          <div className="text-mono text-sm text-muted-foreground mb-2">
            {[item.locationName, formatTripDates(item), times].filter(Boolean).join(' · ')}
          </div>

          {item.catches.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2 mb-3">
              {item.catches.slice(0, 4).map((c) => (
                <span key={c.id} className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1 text-xs">
                  <Fish className="size-3.5 text-muted-foreground" />
                  <span className="font-medium">{c.speciesName ?? 'Catch'}</span>
                  {c.weight != null && <span className="text-muted-foreground">{c.weight} kg</span>}
                </span>
              ))}
              {item.catches.length > 4 && (
                <span className="rounded-lg bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                  +{item.catches.length - 4} more
                </span>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 -ml-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLike}
              disabled={busy}
              className={`px-2 ${liked ? 'text-destructive' : 'text-muted-foreground'} hover:text-destructive`}
            >
              <Heart className="size-4" fill={liked ? 'currentColor' : 'none'} />
              {likeCount}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="px-2 text-muted-foreground hover:text-foreground"
            >
              <MessageCircle className="size-4" />
              Comments ({commentCount})
            </Button>

            <ShareButton tripId={item.id} />
          </div>
        </CardContent>
      </Card>

      <PostDialog
        item={item}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        liked={liked}
        likeCount={likeCount}
        onToggleLike={toggleLike}
        busy={busy}
        onCommentCountChange={setCommentCount}
      />
      {reporting && <ReportDialog targetType="Trip" targetId={item.id} onClose={() => setReporting(false)} />}
    </>
  );
}
