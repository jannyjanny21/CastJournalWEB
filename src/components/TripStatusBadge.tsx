import { Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { isStillFishing, type TripTiming } from '../utils/trip';
import { cn } from '@/lib/utils';

/**
 * Marks a trip that hasn't finished: "Ongoing" while it's still within the 7-day window, or,
 * for the owner only, "Add end time" once it's past it (the trip is stuck without an end).
 * Renders nothing for a finished trip.
 */
export function TripStatusBadge({ trip, isOwner, editHref, className }: {
  trip: TripTiming;
  isOwner: boolean;
  /** Owner's link to finish the trip (edit page). */
  editHref?: string;
  className?: string;
}) {
  if (trip.endTime) return null;

  if (isStillFishing(trip)) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400',
          className,
        )}
        title="Still fishing: no end time yet"
      >
        <span className="relative flex size-2" aria-hidden="true">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60 motion-reduce:animate-none" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
        Ongoing
      </span>
    );
  }

  if (!isOwner) return null;
  const badge = (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400',
        className,
      )}
      title="This trip has no end time and is past the 7-day limit. Add when you finished."
    >
      <AlertCircle className="size-3.5" /> Add end time
    </span>
  );
  // Inside a clickable row the badge stays plain; the row already opens the trip.
  return editHref ? <Link to={editHref} className="relative z-10 no-underline">{badge}</Link> : badge;
}
