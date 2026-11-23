import { useState } from 'react';
import { toast } from 'sonner';
import type { Trip } from '../types/trip';
import { tripsApi } from '../api/trips';
import { isOfflineError } from '../api/client';

/** Shared like state for a trip card and its dialog (optimistic, rolls back on failure). */
export function useTripLike(trip: Trip) {
  const [liked, setLiked] = useState(trip.isLikedByCurrentUser);
  const [likeCount, setLikeCount] = useState(trip.likeCount);
  const [busy, setBusy] = useState(false);

  const toggleLike = async () => {
    if (busy) return;
    setBusy(true);
    const wasLiked = liked;
    setLiked(!wasLiked);
    setLikeCount((c) => c + (wasLiked ? -1 : 1));

    try {
      if (wasLiked) await tripsApi.unlike(trip.id);
      else await tripsApi.like(trip.id);
    } catch (err) {
      setLiked(wasLiked);
      setLikeCount((c) => c + (wasLiked ? 1 : -1));
      // Option 1 offline design (F-13): likes need a connection; only new trips are queued.
      toast.error(
        isOfflineError(err)
          ? wasLiked ? "Couldn't unlike, no connection." : "Couldn't like, no connection."
          : wasLiked ? "Couldn't unlike this trip — try again." : "Couldn't like this trip — try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return { liked, likeCount, busy, toggleLike };
}
