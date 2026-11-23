import { idb, STORES } from './db';

/**
 * Saved copies of what you've viewed, for reading offline (F-13). Kept per user and cleared on
 * logout, so a shared phone never shows the previous angler's trips.
 */

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

// Not worth keeping (or not safe to show stale): sign-in, admin tools, exports, search, live conditions.
const SKIP = [/^\/auth\//, /^\/admin/, /^\/users/, /^\/reports/, /^\/auditlogs/, /^\/backup/, /^\/export/, /^\/search/, /^\/environment/];

let userId: string | null = null;

/** Called by AuthProvider whenever the signed-in user changes. */
export function setReadCacheUser(id: string | null) {
  userId = id;
}

export function isCacheable(path: string): boolean {
  return !SKIP.some((re) => re.test(path.toLowerCase()));
}

/** `today=` makes "this month" follow the viewer's calendar; the saved copy shouldn't depend on it. */
function keyFor(path: string): string | null {
  if (!userId) return null;
  const normalized = path.replace(/([?&])today=[^&]*&?/, '$1').replace(/[?&]$/, '');
  return `${userId}|${normalized}`;
}

type Entry = { data: unknown; savedAt: number };

export async function saveResponse(path: string, data: unknown): Promise<void> {
  const key = keyFor(path);
  if (!key || !isCacheable(path)) return;
  try {
    await idb.put(STORES.responses, key, { data, savedAt: Date.now() } satisfies Entry);
  } catch {
    /* storage full or unavailable: offline viewing just won't have this page */
  }
}

export async function loadResponse<T>(path: string): Promise<{ data: T; savedAt: number } | null> {
  const key = keyFor(path);
  if (!key) return null;
  try {
    const entry = await idb.get<Entry>(STORES.responses, key);
    if (!entry || Date.now() - entry.savedAt > MAX_AGE_MS) return null;
    return { data: entry.data as T, savedAt: entry.savedAt };
  } catch {
    return null;
  }
}

/** Forget every saved copy (logout). */
export async function clearSavedResponses(): Promise<void> {
  try {
    await idb.clear(STORES.responses);
  } catch {
    /* nothing saved */
  }
}

/** Drop copies older than 30 days (run once at start-up). */
export async function pruneSavedResponses(): Promise<void> {
  try {
    const keys = await idb.keys(STORES.responses);
    for (const key of keys) {
      const entry = await idb.get<Entry>(STORES.responses, String(key));
      if (!entry || Date.now() - entry.savedAt > MAX_AGE_MS) await idb.delete(STORES.responses, String(key));
    }
  } catch {
    /* ignore */
  }
}
