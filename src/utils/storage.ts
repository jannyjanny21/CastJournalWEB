import { useEffect, useState } from 'react';

/**
 * How much room the app has left on the device for trips, photos and videos waiting to upload.
 * Browsers report an estimate (navigator.storage.estimate); null where they don't report one.
 */
export interface StorageRoom {
  usage: number;
  quota: number;
  free: number;
}

export async function storageRoom(): Promise<StorageRoom | null> {
  try {
    const est = await navigator.storage?.estimate?.();
    if (!est || !est.quota) return null;
    const usage = est.usage ?? 0;
    return { usage, quota: est.quota, free: Math.max(0, est.quota - usage) };
  } catch {
    return null;
  }
}

/** Space the device should keep free beyond the files themselves (IndexedDB overhead, drafts). */
const MARGIN = 20 * 1024 * 1024;

/**
 * Null when these files fit, otherwise a message saying how much space is missing. Every new
 * trip and catch is saved on the device before it uploads, online or not, so it always applies.
 */
export async function noRoomFor(files: Blob[]): Promise<string | null> {
  const needed = files.reduce((n, f) => n + f.size, 0);
  if (needed === 0) return null;
  const room = await storageRoom();
  if (!room || needed + MARGIN <= room.free) return null;
  return `Not enough space on this device for these files: about ${formatMb(needed)} needed, ${formatMb(room.free)} free. Remove some, free up space, or add them later when you're online.`;
}

export function formatMb(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb >= 1000 ? `${(mb / 1024).toFixed(1)} GB` : `${Math.max(1, Math.round(mb))} MB`;
}

/** True when the app has used over 90% of the space the browser gives it; rechecked when `version` changes. */
export function useStorageAlmostFull(version: unknown): StorageRoom | null {
  const [low, setLow] = useState<StorageRoom | null>(null);
  useEffect(() => {
    let cancelled = false;
    void storageRoom().then((room) => {
      if (!cancelled) setLow(room && room.usage / room.quota > 0.9 ? room : null);
    });
    return () => { cancelled = true; };
  }, [version]);
  return low;
}
