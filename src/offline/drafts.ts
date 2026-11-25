import { useSyncExternalStore } from 'react';
import { idb, STORES } from './db';

/**
 * An unfinished "Log a trip" form, kept on this device (F-27): if the app closes, the phone
 * restarts or you navigate away, the trip and its photos are still there to continue. One draft
 * per angler; it's removed when the trip is saved, when you discard it, and when you log out.
 */

export interface DraftFile {
  name: string;
  type: string;
  blob: Blob;
}

export interface TripDraft<V = unknown> {
  values: V;
  /** Photos and videos per catch row, in row order. */
  photos: DraftFile[][];
  savedAt: number;
}

const keyFor = (userId: string) => `${userId}|new-trip`;

// Saved trips whose form may still have an autosave pending: those saves are ignored, so a
// trip that was just saved can't come back as a draft. Reset when a new form opens (load).
const finished = new Set<string>();

export const drafts = {
  async load<V>(userId: string): Promise<TripDraft<V> | null> {
    finished.delete(userId);
    try {
      return (await idb.get<TripDraft<V>>(STORES.drafts, keyFor(userId))) ?? null;
    } catch {
      return null;
    }
  },

  /** False from save() because the trip was just saved (not because storage failed). */
  isFinished(userId: string): boolean {
    return finished.has(userId);
  },

  async save<V>(userId: string, values: V, photos: File[][]): Promise<boolean> {
    if (finished.has(userId)) return false;
    const draft: TripDraft<V> = {
      values,
      photos: photos.map((row) => row.map((f) => ({ name: f.name, type: f.type, blob: f }))),
      savedAt: Date.now(),
    };
    try {
      await idb.put(STORES.drafts, keyFor(userId), draft);
      return true;
    } catch {
      return false; // storage full or blocked: the form still works, it just isn't kept
    }
  },

  async remove(userId: string): Promise<void> {
    try {
      await idb.delete(STORES.drafts, keyFor(userId));
    } catch {
      /* nothing to remove */
    }
  },

  /** The trip was saved (queued or uploaded): drop the draft and ignore any late autosave. */
  async finish(userId: string): Promise<void> {
    finished.add(userId);
    await drafts.remove(userId);
  },

  /** Logout: drafts belong to the angler who wrote them. */
  async clearAll(): Promise<void> {
    try {
      await idb.clear(STORES.drafts);
    } catch {
      /* storage unavailable */
    }
    await refreshCatchKeys();
  },
};

/** Saved blobs back into Files for the photo pickers. */
export function toFiles(rows: DraftFile[][]): File[][] {
  return rows.map((row) => row.map((f) => new File([f.blob], f.name, { type: f.type })));
}

// ---- Quick catch drafts ------------------------------------------------------------------------
// A half-filled Quick catch, one per trip, so leaving the page or closing the app doesn't lose it.
// Keyed by the saved trip's ID, or "q:<entry id>" for a trip still waiting on this device.

export interface CatchDraft {
  speciesId: string;
  weight: string;
  length: string;
  notes: string;
  photos: DraftFile[];
  savedAt: number;
}

export const catchDraftTarget = {
  saved: (tripId: string) => tripId,
  queued: (entryId: string) => `q:${entryId}`,
};

const catchKey = (userId: string, target: string) => `${userId}|catch|${target}`;

let catchKeys: string[] = [];
const catchListeners = new Set<() => void>();

async function refreshCatchKeys() {
  try {
    catchKeys = (await idb.keys(STORES.drafts)).map(String).filter((k) => k.includes('|catch|'));
  } catch {
    catchKeys = [];
  }
  catchListeners.forEach((l) => l());
}

/** Which trips have an unfinished quick catch (for the "Continue catch" hint). */
export function useCatchDrafts(userId: string | undefined): (target: string) => boolean {
  const keys = useSyncExternalStore(
    (cb) => {
      catchListeners.add(cb);
      if (catchListeners.size === 1) void refreshCatchKeys();
      return () => { catchListeners.delete(cb); };
    },
    () => catchKeys,
    () => catchKeys,
  );
  return (target) => !!userId && keys.includes(catchKey(userId, target));
}

export const catchDrafts = {
  async load(userId: string, target: string): Promise<CatchDraft | null> {
    finished.delete(catchKey(userId, target));
    try {
      return (await idb.get<CatchDraft>(STORES.drafts, catchKey(userId, target))) ?? null;
    } catch {
      return null;
    }
  },

  /** False from save() because the catch was just saved (not because storage failed). */
  isFinished(userId: string, target: string): boolean {
    return finished.has(catchKey(userId, target));
  },

  async save(userId: string, target: string, draft: Omit<CatchDraft, 'photos' | 'savedAt'>, photos: File[]): Promise<boolean> {
    const key = catchKey(userId, target);
    if (finished.has(key)) return false;
    try {
      await idb.put(STORES.drafts, key, {
        ...draft,
        photos: photos.map((f) => ({ name: f.name, type: f.type, blob: f })),
        savedAt: Date.now(),
      } satisfies CatchDraft);
      await refreshCatchKeys();
      return true;
    } catch {
      return false;
    }
  },

  async remove(userId: string, target: string): Promise<void> {
    try {
      await idb.delete(STORES.drafts, catchKey(userId, target));
    } catch {
      /* nothing to remove */
    }
    await refreshCatchKeys();
  },

  /** The catch was saved: drop the draft and ignore a late autosave. */
  async finish(userId: string, target: string): Promise<void> {
    finished.add(catchKey(userId, target));
    await catchDrafts.remove(userId, target);
  },

  /** A trip waiting on the device uploaded: its unfinished catch follows it to the saved trip. */
  async move(userId: string, from: string, to: string): Promise<void> {
    try {
      const draft = await idb.get<CatchDraft>(STORES.drafts, catchKey(userId, from));
      if (!draft) return;
      await idb.put(STORES.drafts, catchKey(userId, to), draft);
      await idb.delete(STORES.drafts, catchKey(userId, from));
    } catch {
      /* best effort */
    }
    await refreshCatchKeys();
  },
};
