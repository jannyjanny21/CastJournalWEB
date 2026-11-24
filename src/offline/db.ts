/** A minimal promise wrapper around IndexedDB for the offline features (F-13). */

const DB_NAME = 'castjournal-offline';
const DB_VERSION = 3;

/**
 * responses: saved copies for reading offline. outbox: trips logged on this device, waiting to upload.
 * drafts: a trip form you started but didn't save yet.
 */
export const STORES = { responses: 'responses', outbox: 'outbox', drafts: 'drafts' } as const;
type StoreName = (typeof STORES)[keyof typeof STORES];

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORES.responses)) db.createObjectStore(STORES.responses);
        if (!db.objectStoreNames.contains(STORES.outbox)) db.createObjectStore(STORES.outbox);
        if (!db.objectStoreNames.contains(STORES.drafts)) db.createObjectStore(STORES.drafts);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    // A failed open (private mode, blocked storage) shouldn't stay cached forever.
    dbPromise.catch(() => { dbPromise = null; });
  }
  return dbPromise;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }),
  );
}

export const idb = {
  get: <T>(store: StoreName, key: string) => run<T | undefined>(store, 'readonly', (s) => s.get(key) as IDBRequest<T | undefined>),
  put: (store: StoreName, key: string, value: unknown) => run(store, 'readwrite', (s) => s.put(value, key)),
  delete: (store: StoreName, key: string) => run(store, 'readwrite', (s) => s.delete(key)),
  clear: (store: StoreName) => run(store, 'readwrite', (s) => s.clear()),
  keys: (store: StoreName) => run<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys()),
  all: <T>(store: StoreName) => run<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>),
};
