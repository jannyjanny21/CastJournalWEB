import { afterEach, describe, expect, it, vi } from 'vitest';
import { noRoomFor } from './storage';

/** Device storage checks before photos and videos are kept for upload. */
const MB = 1024 * 1024;

function deviceWith(usageMb: number, quotaMb: number) {
  vi.stubGlobal('navigator', { storage: { estimate: async () => ({ usage: usageMb * MB, quota: quotaMb * MB }) } });
}

afterEach(() => vi.unstubAllGlobals());

describe('room on the device for new photos and videos', () => {
  it('S-01 accepts files that fit, with room to spare', async () => {
    deviceWith(100, 1000);
    expect(await noRoomFor([new Blob([new Uint8Array(5 * MB)])])).toBeNull();
  });

  it('S-02 warns, with the sizes, when the files would not fit', async () => {
    deviceWith(990, 1000);
    const msg = await noRoomFor([new Blob([new Uint8Array(25 * MB)])]);
    expect(msg).toMatch(/Not enough space/);
    expect(msg).toMatch(/25 MB needed, 10 MB free/);
  });

  it('S-03 says nothing when the browser does not report its storage', async () => {
    vi.stubGlobal('navigator', {});
    expect(await noRoomFor([new Blob([new Uint8Array(MB)])])).toBeNull();
  });
});
