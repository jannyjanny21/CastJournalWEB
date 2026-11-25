import 'fake-indexeddb/auto';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * F-20 / F-13: the offline queue on the device. The API is replaced by an in-memory fake that can
 * be switched "offline", so these tests show what a device does without signal and on reconnect.
 */

const server = vi.hoisted(() => ({
  offline: false,
  failCatches: 0,
  calls: [] as string[],
  nextCatch: 0,
}));

vi.mock('../api/client', () => ({
  isOfflineError: (e: unknown) => !!e && typeof e === 'object' && (e as { status?: number }).status === 0,
}));

vi.mock('../api/trips', () => ({
  tripsApi: {
    create: async (p: { clientId: string; newLocation?: { name: string } | null }) => {
      if (server.offline) throw { status: 0 };
      server.calls.push(`createTrip:${p.clientId}`);
      if (p.newLocation) server.calls.push(`newSpot:${p.newLocation.name}`);
      return { id: `T-${p.clientId}` };
    },
    addCatch: async (tripId: string, p: { clientId: string }) => {
      if (server.offline) throw { status: 0 };
      if (server.failCatches > 0) {
        server.failCatches--;
        throw { status: 404, message: 'Trip not found.' };
      }
      server.calls.push(`addCatch:${tripId}:${p.clientId}`);
      return { id: `C${++server.nextCatch}` };
    },
  },
}));

vi.mock('../api/catches', () => ({
  catchesApi: {
    uploadMedia: async (catchId: string, _file: Blob, clientId: string) => {
      if (server.offline) throw { status: 0 };
      server.calls.push(`media:${catchId}:${clientId}`);
    },
  },
}));

const { outbox, syncAll, syncOne, pendingCatchesFor } = await import('./outbox');
const { idb, STORES } = await import('./db');
const { catchDrafts, catchDraftTarget } = await import('./drafts');

type Entry = Parameters<typeof outbox.add>[0];

const catchItem = (clientId: string, withPhoto = false) => ({
  clientId,
  payload: { speciesId: 's1' } as never,
  media: withPhoto
    ? [{ clientId: `${clientId}-photo`, file: new Blob(['x']), name: 'fish.jpg', type: 'image/jpeg', uploaded: false }]
    : [],
});

const tripEntry = (id: string, catches = [catchItem(`${id}-c1`)]): Entry => ({
  id,
  userId: 'u1',
  createdAt: 0,
  locationName: null,
  publishAfterSave: false,
  status: 'pending',
  trip: {
    title: 'Night session', tripDate: '2026-11-24', startTime: '18:00', endTime: null,
    locationId: null, notes: null, weatherConditions: null,
  } as never,
  catches,
});

const quickCatchFor = (tripId: string, clientId: string): Entry => ({
  ...tripEntry(`Q-${clientId}`, [catchItem(clientId, true)]),
  kind: 'catch',
  serverTripId: tripId,
});

const queued = () => idb.all<Entry>(STORES.outbox);

beforeAll(() => {
  Object.defineProperty(globalThis.navigator, 'onLine', { get: () => !server.offline, configurable: true });
  outbox.setUser('u1');
});

beforeEach(async () => {
  server.offline = false;
  server.failCatches = 0;
  server.calls = [];
  await idb.clear(STORES.outbox);
  await idb.clear(STORES.drafts);
});

describe('logging without signal', () => {
  it('O-11 keeps a trip on the device while offline and uploads it once back online', async () => {
    server.offline = true;
    await outbox.add(tripEntry('A'));
    expect((await syncOne('A')).state).toBe('offline');
    expect(await queued()).toHaveLength(1);

    server.offline = false;
    await syncAll();

    expect(server.calls).toEqual(['createTrip:A', 'addCatch:T-A:A-c1']);
    expect(await queued()).toHaveLength(0);
  });

  it('O-12 uploads a quick catch to an existing trip, with its photo, without creating a trip', async () => {
    server.offline = true;
    await outbox.add(quickCatchFor('T1', 'qc1'));
    await syncAll();
    expect(server.calls).toEqual([]);

    server.offline = false;
    await syncAll();

    expect(server.calls).toHaveLength(2);
    expect(server.calls[0]).toBe('addCatch:T1:qc1');
    expect(server.calls[1]).toMatch(/^media:C\d+:qc1-photo$/);
    expect(server.calls.some((c) => c.startsWith('createTrip'))).toBe(false);
  });

  it('O-13 keeps a catch whose trip was deleted meanwhile, marked as needing attention', async () => {
    server.failCatches = 1;
    await outbox.add(quickCatchFor('T-gone', 'qc2'));

    expect((await syncOne('Q-qc2')).state).toBe('attention');
    const left = await queued();
    expect(left).toHaveLength(1);
    expect(pendingCatchesFor(left, 'T-gone')).toHaveLength(1);
    expect(pendingCatchesFor(left, 'T-other')).toHaveLength(0);
  });
});

describe('quick catches for a trip still on the device', () => {
  it('O-14 joins the waiting trip, and everything uploads as one trip', async () => {
    server.offline = true;
    const trip = tripEntry('B');
    await outbox.add(trip);
    expect(await outbox.addCatchToQueued(trip, catchItem('q1'))).toBe('queued');
    expect(await outbox.addCatchToQueued(trip, catchItem('q2'))).toBe('queued');

    const waiting = await queued();
    expect(waiting).toHaveLength(1);
    expect(waiting[0].catches).toHaveLength(3);

    server.offline = false;
    await syncAll();
    expect(server.calls.filter((c) => c.startsWith('createTrip'))).toEqual(['createTrip:B']);
    expect(server.calls).toEqual(expect.arrayContaining(['addCatch:T-B:B-c1', 'addCatch:T-B:q1', 'addCatch:T-B:q2']));
  });

  it('O-15 goes to the saved trip if the trip finished uploading just before', async () => {
    const trip = tripEntry('C');
    await outbox.add(trip);
    await syncAll(); // uploads C
    expect(await outbox.addCatchToQueued(trip, catchItem('late'))).toBe('queued');

    const waiting = await queued();
    expect(waiting[0]).toMatchObject({ kind: 'catch', serverTripId: 'T-C' });
    await syncAll();
    expect(server.calls).toContain('addCatch:T-C:late');
  });

  it('O-16 reports a trip it no longer knows instead of losing the catch silently', async () => {
    expect(await outbox.addCatchToQueued(tripEntry('Unknown'), catchItem('x'))).toBe('missing');
    expect(await queued()).toHaveLength(0);
  });

  it('O-17 never loses a catch added while an upload is running', async () => {
    const trip = tripEntry('D');
    await outbox.add(trip);
    const upload = syncAll();
    const adding = outbox.addCatchToQueued(trip, catchItem('during'));
    await upload;
    await adding;
    await syncAll();
    expect(server.calls).toContain('addCatch:T-D:during');
  });
});

describe('unfinished quick catches (drafts)', () => {
  it('O-18 follow their trip from the device queue to the saved trip after upload', async () => {
    const trip = tripEntry('E');
    await outbox.add(trip);
    await catchDrafts.save('u1', catchDraftTarget.queued('E'),
      { speciesId: 's1', weight: '2.5', length: '', notes: 'by the rocks' }, [new File(['x'], 'fish.jpg', { type: 'image/jpeg' })]);

    await syncAll();

    expect(await catchDrafts.load('u1', catchDraftTarget.queued('E'))).toBeNull();
    const moved = await catchDrafts.load('u1', catchDraftTarget.saved('T-E'));
    expect(moved).toMatchObject({ speciesId: 's1', weight: '2.5', notes: 'by the rocks' });
    expect(moved?.photos).toHaveLength(1);
  });
});

describe('a fishing spot added without signal', () => {
  it('O-19 sends the spot made on the device with its trip, once, when back online', async () => {
    server.offline = true;
    const entry = tripEntry('S');
    entry.trip = { ...entry.trip, newLocation: {
      name: 'Breakwater, north end', description: null, latitude: 8.5881, longitude: 123.3409, waterType: 'Saltwater', isPublic: false,
    } } as never;
    await outbox.add(entry);
    expect((await syncOne('S')).state).toBe('offline');

    server.offline = false;
    await syncAll();
    await syncAll();

    expect(server.calls).toEqual(['createTrip:S', 'newSpot:Breakwater, north end', 'addCatch:T-S:S-c1']);
    expect(await queued()).toHaveLength(0);
  });
});
