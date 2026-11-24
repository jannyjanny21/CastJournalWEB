import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';

/**
 * F-27: unfinished trip forms and quick catches kept on the device. This file starts from a
 * device that already has the previous (version 2) offline database with a trip waiting in it.
 */

await new Promise<void>((resolve, reject) => {
  const request = indexedDB.open('castjournal-offline', 2);
  request.onupgradeneeded = () => {
    request.result.createObjectStore('responses');
    request.result.createObjectStore('outbox');
  };
  request.onsuccess = () => {
    const tx = request.result.transaction('outbox', 'readwrite');
    tx.objectStore('outbox').put({ id: 'waiting-trip' }, 'waiting-trip');
    tx.oncomplete = () => { request.result.close(); resolve(); };
  };
  request.onerror = () => reject(request.error);
});

const { idb, STORES } = await import('./db');
const { drafts, toFiles, catchDrafts, catchDraftTarget } = await import('./drafts');

const photo = () => new File([new Uint8Array([1, 2, 3])], 'bass.jpg', { type: 'image/jpeg' });

describe('offline database upgrade', () => {
  it('D-01 keeps trips waiting to upload when the drafts store is added', async () => {
    expect(await idb.get(STORES.outbox, 'waiting-trip')).toEqual({ id: 'waiting-trip' });
  });
});

describe('trip form drafts', () => {
  it('D-02 bring back the form and its photos', async () => {
    expect(await drafts.save('u1', { title: 'Dawn', catches: [{}, {}] }, [[photo()], []])).toBe(true);

    const draft = await drafts.load<{ title: string }>('u1');
    expect(draft?.values.title).toBe('Dawn');
    const files = toFiles(draft!.photos);
    expect(files[0][0]).toMatchObject({ name: 'bass.jpg', type: 'image/jpeg', size: 3 });
    expect(files[1]).toHaveLength(0);
  });

  it('D-03 are kept per angler', async () => {
    await drafts.save('u1', { title: 'Mine' }, []);
    expect(await drafts.load('someone-else')).toBeNull();
  });

  it('D-04 are removed once the trip is saved, and a late autosave cannot bring them back', async () => {
    await drafts.save('u1', { title: 'Saving' }, []);
    await drafts.finish('u1');
    expect(await drafts.save('u1', { title: 'late autosave' }, [])).toBe(false);
    expect(await drafts.load('u1')).toBeNull();

    expect(await drafts.save('u1', { title: 'next trip' }, [])).toBe(true); // a new form can draft again
  });
});

describe('quick catch drafts', () => {
  it('D-05 are kept per trip and removed once the catch is saved', async () => {
    const fields = { speciesId: 's1', weight: '1.2', length: '30', notes: '' };
    await catchDrafts.save('u1', catchDraftTarget.saved('trip-1'), fields, [photo()]);

    expect(await catchDrafts.load('u1', catchDraftTarget.saved('trip-2'))).toBeNull();
    expect(await catchDrafts.load('u1', catchDraftTarget.saved('trip-1'))).toMatchObject(fields);

    await catchDrafts.finish('u1', catchDraftTarget.saved('trip-1'));
    expect(await catchDrafts.save('u1', catchDraftTarget.saved('trip-1'), fields, [])).toBe(false);
    expect(await catchDrafts.load('u1', catchDraftTarget.saved('trip-1'))).toBeNull();
  });

  it('D-06 are all removed on logout', async () => {
    await drafts.save('u1', { title: 'x' }, []);
    await catchDrafts.save('u1', catchDraftTarget.saved('trip-3'), { speciesId: '', weight: '', length: '', notes: 'n' }, []);
    await drafts.clearAll();
    expect(await idb.keys(STORES.drafts)).toHaveLength(0);
  });
});
