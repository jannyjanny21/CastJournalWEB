import type { Trip } from '../types/trip';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { formatTripDates, tripCoverMedia, tripHeading } from '../utils/trip';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Heart } from 'lucide-react';
import { CommentSection } from './CommentSection';
import { ReportButton } from './ReportDialog';
import { useAuth } from '../context/useAuth';

export function PostDialog({
  item,
  open,
  onOpenChange,
  liked,
  likeCount,
  onToggleLike,
  busy,
  onCommentCountChange,
}: {
  item: Trip;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  liked: boolean;
  likeCount: number;
  onToggleLike: () => void;
  busy: boolean;
  onCommentCountChange?: (count: number) => void;
}) {
  const cover = tripCoverMedia(item);
  const { user } = useAuth();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[87vh] overflow-y-auto rounded-2xl">
        <div className="flex items-center gap-2">
          {item.userAvatarUrl ? (
            <img src={resolveMediaUrl(item.userAvatarUrl)} alt="" className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted" />
          )}
          <strong className="text-sm">{item.userFullName ?? 'Angler'}</strong>
        </div>

        {cover && cover.mediaType !== 'Video' && (
          <img
            src={resolveMediaUrl(cover.mediaUrl)}
            alt={tripHeading(item)}
            className="w-full h-auto max-h-[32rem] object-contain rounded-lg bg-muted"
          />
        )}

        <div>
          <strong className="text-base">{tripHeading(item)}</strong>
          <div className="text-mono text-sm text-muted-foreground">
            {[item.locationName, formatTripDates(item)].filter(Boolean).join(' · ')}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleLike}
          disabled={busy}
          className={`w-fit px-2 -ml-2 ${liked ? 'text-destructive' : 'text-muted-foreground'} hover:text-destructive`}
        >
          <Heart className="size-4" fill={liked ? 'currentColor' : 'none'} />
          {likeCount}
        </Button>
        {item.isPublic && user?.id !== item.userId && (
          <div className="-mt-2 flex justify-end">
            <ReportButton targetType="Trip" targetId={item.id} />
          </div>
        )}

        <CommentSection tripId={item.id} onCountChange={onCommentCountChange} canReport={item.isPublic} />
      </DialogContent>
    </Dialog>
  );
}
