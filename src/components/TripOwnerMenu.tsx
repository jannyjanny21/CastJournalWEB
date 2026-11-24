import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MoreHorizontal, Pencil, Globe, Lock, Eye, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import type { Trip } from '../types/trip';
import { tripsApi } from '../api/trips';
import { isOfflineError } from '../api/client';
import { useConfirm } from '../hooks/useConfirm';
import { PublishDialog } from './PublishDialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from './ui/dropdown-menu';
import { cn } from '@/lib/utils';

/**
 * "⋯" menu on your own trip (feed card, My Trips row, trip page): Edit, Publish / Withdraw, Delete.
 * Withdraw and Delete ask first; Delete offers Undo, since it only moves the trip to Recently deleted.
 */
export function TripOwnerMenu({ trip, onChange, onDeleted, onRestored, className }: {
  trip: Trip;
  /** The trip after publishing or withdrawing. */
  onChange: (t: Trip) => void;
  onDeleted: () => void;
  /** After Undo on a delete. */
  onRestored?: (t: Trip) => void;
  className?: string;
}) {
  const navigate = useNavigate();
  const ask = useConfirm();
  const [publishOpen, setPublishOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const removed = trip.removedFromCommunity;

  const withdraw = async () => {
    const ok = await ask({
      title: 'Withdraw this trip?',
      description: 'It becomes private again and leaves the community feed. Likes and comments are kept.',
      confirmLabel: 'Withdraw',
    });
    if (!ok) return;
    setWorking(true);
    try {
      onChange(await tripsApi.unpublish(trip.id));
      toast.success('Trip withdrawn — it is private again.');
    } catch (err) {
      toast.error(isOfflineError(err) ? "Couldn't withdraw, no connection." : "Couldn't withdraw this trip — try again.");
    } finally {
      setWorking(false);
    }
  };

  const remove = async () => {
    const ok = await ask({
      title: 'Delete this trip and its catches?',
      description: 'You can restore it from My Trips → Recently deleted for 30 days.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setWorking(true);
    try {
      await tripsApi.remove(trip.id);
      const id = trip.id;
      onDeleted();
      toast('Trip moved to Recently deleted.', {
        duration: 8000,
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              const restored = await tripsApi.restore(id);
              if (onRestored) onRestored(restored);
              else navigate(`/trips/${id}`);
              toast.success('Trip restored. It’s private now; publish it again if you want.');
            } catch {
              toast.error("Couldn't restore — try from Recently deleted.");
            }
          },
        },
      });
    } catch (err) {
      toast.error(isOfflineError(err) ? "Couldn't delete, no connection." : "Couldn't delete this trip — try again.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Trip options"
          disabled={working}
          className={cn('rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground', className)}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem onClick={() => navigate(`/trips/${trip.id}/edit`)}>
            <Pencil /> Edit trip
          </DropdownMenuItem>
          {!removed && !trip.isPublic && (
            <DropdownMenuItem onClick={() => setPublishOpen(true)}>
              <Globe /> Publish…
            </DropdownMenuItem>
          )}
          {!removed && trip.isPublic && (
            <>
              <DropdownMenuItem onClick={() => setPublishOpen(true)}>
                <Eye /> Change location visibility
              </DropdownMenuItem>
              <DropdownMenuItem onClick={withdraw}>
                <Lock /> Withdraw (make private)
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onClick={remove} className="text-destructive data-highlighted:text-destructive">
            <Trash2 /> Delete trip
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <PublishDialog
        tripId={trip.id}
        open={publishOpen}
        onOpenChange={setPublishOpen}
        onPublished={(t) => {
          onChange(t);
          toast.success(trip.isPublic ? 'Location visibility updated.' : 'Trip published to the community feed.');
        }}
      />
    </>
  );
}
