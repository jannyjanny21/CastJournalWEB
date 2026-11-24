import type { Trip } from '../types/trip';
import type { Catch } from '../types/catch';
import { resolveMediaUrl } from './mediaUrl';

export interface ViewerItem {
  id: string;
  url: string;
  type: string; // 'Image' | 'Video'
  caption?: string;
}

function caption(c: Catch): string {
  const size = [c.weight != null ? `${c.weight} kg` : null, c.length != null ? `${c.length} cm` : null].filter(Boolean).join(' · ');
  return [c.speciesName ?? 'Catch', size].filter(Boolean).join(' — ');
}

/** Every photo and video of a trip, catch by catch, in order, with the catch as caption. */
export function tripViewerItems(trip: Trip): ViewerItem[] {
  return trip.catches.flatMap((c) =>
    [...c.media]
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((m) => ({ id: m.id, url: resolveMediaUrl(m.mediaUrl), type: m.mediaType, caption: caption(c) })),
  );
}
