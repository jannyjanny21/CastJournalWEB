import { useSyncExternalStore } from 'react';

/**
 * Whether the app is online, and whether the page on screen came from the device's saved copy
 * (F-13). `navigator.onLine` alone isn't enough: a phone can have "signal" but no working
 * connection, so the API client also reports when it had to fall back to saved data.
 */
type State = { online: boolean; savedCopyFrom: number | null };

let state: State = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  savedCopyFrom: null,
};
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  const merged = { ...state, ...next };
  if (merged.online === state.online && merged.savedCopyFrom === state.savedCopyFrom) return;
  state = merged;
  listeners.forEach((l) => l());
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => set({ online: true }));
  window.addEventListener('offline', () => set({ online: false }));
}

export const offlineStatus = {
  /** A request reached the server: we're online and the data is live. */
  reachedServer: () => set({ online: true, savedCopyFrom: null }),
  /** The server couldn't be reached; `savedAt` is when the copy shown was saved (or null if none). */
  usedSavedCopy: (savedAt: number | null) => set({ online: false, savedCopyFrom: savedAt ?? state.savedCopyFrom }),
  wentOffline: () => set({ online: false }),
  get: () => state,
};

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useOfflineStatus(): State {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
