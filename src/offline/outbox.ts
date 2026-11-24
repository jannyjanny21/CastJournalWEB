import { useSyncExternalStore } from 'react';
import { idb, STORES } from './db';
import { isOfflineError } from '../api/client';
import { tripsApi } from '../api/trips';
import { catchesApi } from '../api/catches';
import type { CreateCatchPayload } from '../types/catch';
import type { UpdateTripPayload } from '../types/trip';

/**
 * Trips logged on this device, waiting to upload (F-13, the "Facebook-style" offline design:
 * new content is queued; edits and deletes still need a connection).
 *
 * Every new trip goes through here, online or not. Each trip, catch and file carries an ID made
 * on the device, and the API returns the existing record for an ID it has already seen, so an
 * upload interrupted halfway can simply be retried without creating duplicates.
 *
 * A quick catch for a trip that's already saved (still fishing) is queued the same way, as an
 * entry with kind "catch": serverTripId is known from the start, so the upload skips straight to
 * the catch and its files.
 */

export interface OutboxMedia {
  clientId: string;
  /** Released (null) once uploaded, to free space on the device. */
  file: Blob | null;
  name: string;
  type: string;
  uploaded: boolean;
  error?: string;
}

export interface OutboxCatch {
  clientId: string;
  payload: CreateCatchPayload;
  serverId?: string;
  error?: string;
  media: OutboxMedia[];
}

export type OutboxStatus = 'pending' | 'syncing' | 'failed' | 'attention';

export interface OutboxEntry {
  id: string; // also the trip's clientId (for kind "trip")
  /** "trip" (default): a new trip with its catches · "catch": catches for an existing trip (serverTripId). */
  kind?: 'trip' | 'catch';
  userId: string;
  createdAt: number;
  trip: UpdateTripPayload;
  locationName: string | null;
  publishAfterSave: boolean;
  catches: OutboxCatch[];
  serverTripId?: string;
  /** pending: waiting to upload · failed: the server refused the trip · attention: trip saved, some catch or file wasn't */
  status: OutboxStatus;
  error?: string;
}

export type SyncResult =
  | { state: 'done'; tripId: string; entry: OutboxEntry }
  | { state: 'offline' }
  | { state: 'failed'; error: string }
  | { state: 'attention'; tripId: string; error: string };

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback for non-secure origins (e.g. testing over a LAN IP).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

// ---- store for the UI -------------------------------------------------------------------

// Queued trips that finished uploading in this session: entry id → server trip id. Lets a quick
// catch aimed at a trip that uploaded a moment ago still find it.
const uploadedTripIds = new Map<string, string>();

type Snapshot = { entries: OutboxEntry[]; syncing: boolean; uploadedVersion: number };
let snapshot: Snapshot = { entries: [], syncing: false, uploadedVersion: 0 };
let currentUser: string | null = null;
const listeners = new Set<() => void>();
const uploadedListeners = new Set<(entry: OutboxEntry, tripId: string) => void>();

function emit(next: Partial<Snapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((l) => l());
}

async function refresh() {
  if (!currentUser) {
    emit({ entries: [] });
    return;
  }
  try {
    const all = await idb.all<OutboxEntry>(STORES.outbox);
    emit({ entries: all.filter((e) => e.userId === currentUser).sort((a, b) => a.createdAt - b.createdAt) });
  } catch {
    emit({ entries: [] });
  }
}

export function useOutbox(): Snapshot {
  return useSyncExternalStore(
    (cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; },
    () => snapshot,
    () => snapshot,
  );
}

/** Quick catches still waiting for this trip (shown on the trip page). */
export function pendingCatchesFor(entries: OutboxEntry[], tripId: string): OutboxEntry[] {
  return entries.filter((e) => e.kind === 'catch' && e.serverTripId === tripId);
}

/** Called after a queued trip finishes uploading in the background. */
export function onTripUploaded(fn: (entry: OutboxEntry, tripId: string) => void): () => void {
  uploadedListeners.add(fn);
  return () => { uploadedListeners.delete(fn); };
}

// ---- queue operations --------------------------------------------------------------------

async function save(entry: OutboxEntry) {
  await idb.put(STORES.outbox, entry.id, entry);
}

export const outbox = {
  setUser(userId: string | null) {
    if (currentUser === userId) return;
    currentUser = userId;
    void refresh();
  },

  async add(entry: OutboxEntry) {
    if (!entry.createdAt) entry.createdAt = Date.now();
    await save(entry);
    // Ask the browser not to clear our storage under pressure (best effort; mostly Chrome/Android).
    void navigator.storage?.persist?.().catch(() => false);
    await refresh();
  },

  async remove(id: string) {
    await idb.delete(STORES.outbox, id);
    await refresh();
  },

  /** Logout: forget this angler's queued trips on this device. */
  async clearUser(userId: string) {
    const all = await idb.all<OutboxEntry>(STORES.outbox);
    for (const e of all.filter((x) => x.userId === userId)) await idb.delete(STORES.outbox, e.id);
    await refresh();
  },

  /**
   * Quick catch for a trip that's still on this device (logged offline, not uploaded yet): the
   * catch joins that trip and uploads with it. Runs under the upload lock, so it never collides
   * with an upload in progress. If the trip finished uploading meanwhile, the catch is queued for
   * the saved trip instead. 'missing': the trip is gone from the queue and its server ID unknown.
   */
  async addCatchToQueued(target: OutboxEntry, item: OutboxCatch): Promise<'queued' | 'missing'> {
    const outcome = await exclusive(async () => {
      const entry = await idb.get<OutboxEntry>(STORES.outbox, target.id);
      if (entry) {
        entry.catches.push(item);
        // Trip saved but a part failed: upload again, which also retries the failed parts.
        if (entry.status === 'attention') {
          entry.status = 'pending';
          entry.error = undefined;
        }
        await save(entry);
        return 'queued' as const;
      }
      const serverTripId = uploadedTripIds.get(target.id);
      if (!serverTripId) return 'missing' as const;
      await save({
        ...target,
        id: newId(),
        kind: 'catch',
        createdAt: Date.now(),
        serverTripId,
        publishAfterSave: false,
        status: 'pending',
        error: undefined,
        catches: [item],
      });
      return 'queued' as const;
    });
    await refresh();
    return outcome;
  },

  /** Try again: a failed or partly-uploaded trip goes back to waiting. */
  async retry(id: string) {
    const entry = await idb.get<OutboxEntry>(STORES.outbox, id);
    if (!entry) return;
    entry.status = 'pending';
    entry.error = undefined;
    for (const c of entry.catches) {
      c.error = undefined;
      for (const m of c.media) m.error = undefined;
    }
    await save(entry);
    await refresh();
    void syncAll();
  },
};

// ---- sync ----------------------------------------------------------------------------------

const OFFLINE = Symbol('offline');
let lock: Promise<unknown> = Promise.resolve();

/**
 * One upload at a time, in order, so catches and files always follow their trip. The browser's
 * Web Locks make that hold across every open window of the app on this device (a browser tab and
 * the installed app, or two tabs), so they never send the same queued item at the same moment.
 */
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  const guarded = (): Promise<T> => (locks?.request ? locks.request('castjournal-outbox', fn) : fn());
  const run = lock.then(guarded, guarded);
  lock = run.catch(() => undefined);
  return run;
}

function messageOf(err: unknown): string {
  return err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Upload failed.';
}

function statusOf(err: unknown): number | undefined {
  return err && typeof err === 'object' && 'status' in err ? Number((err as { status: unknown }).status) : undefined;
}

/** Offline or signed out: stop and keep everything for the next attempt. */
function stopIfUnreachable(err: unknown) {
  if (isOfflineError(err) || statusOf(err) === 401) throw OFFLINE;
}

async function upload(entry: OutboxEntry): Promise<SyncResult> {
  entry.status = 'syncing';
  await save(entry);
  emit({ entries: snapshot.entries.map((e) => (e.id === entry.id ? entry : e)) });

  try {
    if (!entry.serverTripId) {
      try {
        const trip = await tripsApi.create({ ...entry.trip, clientId: entry.id, catches: [] });
        entry.serverTripId = trip.id;
      } catch (err) {
        stopIfUnreachable(err);
        // 409: either deleted after an earlier upload, or the same upload racing itself; one retry settles it.
        if (statusOf(err) === 409) {
          try {
            const trip = await tripsApi.create({ ...entry.trip, clientId: entry.id, catches: [] });
            entry.serverTripId = trip.id;
          } catch (again) {
            stopIfUnreachable(again);
            entry.status = 'failed';
            entry.error = messageOf(again);
            await save(entry);
            return { state: 'failed', error: entry.error };
          }
        } else {
          entry.status = 'failed';
          entry.error = messageOf(err);
          await save(entry);
          return { state: 'failed', error: entry.error };
        }
      }
      await save(entry);
    }

    for (const c of entry.catches) {
      if (!c.serverId) {
        try {
          const created = await tripsApi.addCatch(entry.serverTripId!, { ...c.payload, clientId: c.clientId });
          c.serverId = created.id;
          c.error = undefined;
        } catch (err) {
          stopIfUnreachable(err);
          c.error = messageOf(err);
          await save(entry);
          continue; // its files can't go without it
        }
        await save(entry);
      }

      for (const m of c.media) {
        if (m.uploaded || !m.file) continue;
        try {
          await catchesApi.uploadMedia(c.serverId!, m.file, m.clientId, m.name);
          m.uploaded = true;
          m.file = null;
          m.error = undefined;
        } catch (err) {
          stopIfUnreachable(err);
          m.error = messageOf(err);
        }
        await save(entry);
      }
    }

    const problems = entry.catches.flatMap((c) => [
      ...(c.error ? [`Catch: ${c.error}`] : []),
      ...c.media.filter((m) => m.error).map((m) => `${m.name}: ${m.error}`),
    ]);
    if (problems.length > 0) {
      entry.status = 'attention';
      entry.error = problems.join(' · ');
      await save(entry);
      return { state: 'attention', tripId: entry.serverTripId!, error: entry.error };
    }

    await idb.delete(STORES.outbox, entry.id);
    uploadedTripIds.set(entry.id, entry.serverTripId!);
    return { state: 'done', tripId: entry.serverTripId!, entry };
  } catch (err) {
    if (err !== OFFLINE) throw err;
    entry.status = 'pending';
    await save(entry);
    return { state: 'offline' };
  }
}

/** Upload one queued trip now (the trip form, right after saving). */
export function syncOne(id: string): Promise<SyncResult> {
  return exclusive(async () => {
    const entry = await idb.get<OutboxEntry>(STORES.outbox, id);
    if (!entry) return { state: 'failed', error: 'Not found on this device.' } as SyncResult;
    const result = await upload(entry);
    await refresh();
    if (result.state === 'done') emit({ uploadedVersion: snapshot.uploadedVersion + 1 });
    return result;
  });
}

/** Upload everything waiting for the signed-in angler (start-up, reconnect, every minute). */
export function syncAll(): Promise<void> {
  return exclusive(async () => {
    if (!currentUser || (typeof navigator !== 'undefined' && !navigator.onLine)) return;
    const user = currentUser;
    const waiting = (await idb.all<OutboxEntry>(STORES.outbox).catch(() => [] as OutboxEntry[]))
      .filter((e) => e.userId === user && (e.status === 'pending' || e.status === 'syncing'))
      .sort((a, b) => a.createdAt - b.createdAt);
    if (waiting.length === 0) return;

    emit({ syncing: true });
    try {
      for (const entry of waiting) {
        const result = await upload(entry);
        if (result.state === 'offline') break;
        if (result.state === 'done') {
          emit({ uploadedVersion: snapshot.uploadedVersion + 1 });
          uploadedListeners.forEach((fn) => fn(entry, result.tripId));
        }
      }
    } finally {
      emit({ syncing: false });
      await refresh();
    }
  });
}
