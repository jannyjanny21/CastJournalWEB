import { useState } from 'react';
import { ArrowDown, ArrowUp, X } from 'lucide-react';
import { toast } from 'sonner';
import { catchesApi } from '../api/catches';
import type { CatchMedia } from '../types/catch';
import { resolveMediaUrl } from '../utils/mediaUrl';
import { apiErrorMessage } from '../utils/errorMessage';

/**
 * A catch's uploaded photos/videos: change their order (saved straight away, FR-10) or remove one.
 */
export function MediaManager({
  catchId,
  media,
  onChange,
}: {
  catchId: string;
  media: CatchMedia[];
  onChange: (media: CatchMedia[]) => void;
}) {
  const [busy, setBusy] = useState(false);
  const ordered = [...media].sort((a, b) => a.orderIndex - b.orderIndex);

  const move = async (i: number, dir: -1 | 1) => {
    const next = [...ordered];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    setBusy(true);
    const before = media;
    onChange(next.map((m, idx) => ({ ...m, orderIndex: idx }))); // optimistic
    try {
      onChange(await catchesApi.reorderMedia(catchId, next.map((m) => m.id)));
    } catch (err) {
      onChange(before);
      toast.error(apiErrorMessage(err, "Couldn't save the new order."));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (m: CatchMedia) => {
    if (!confirm(`Remove this ${m.mediaType === 'Video' ? 'video' : 'photo'}?`)) return;
    setBusy(true);
    try {
      await catchesApi.deleteMedia(m.id);
      onChange(media.filter((x) => x.id !== m.id));
    } catch (err) {
      toast.error(apiErrorMessage(err, "Couldn't remove it."));
    } finally {
      setBusy(false);
    }
  };

  if (ordered.length === 0) return null;

  return (
    <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
      {ordered.map((m, i) => (
        <li key={m.id} className="relative w-28 overflow-hidden rounded-md border border-border">
          {m.mediaType === 'Video' ? (
            <video src={resolveMediaUrl(m.mediaUrl)} className="h-20 w-full bg-black object-cover" muted preload="metadata" />
          ) : (
            <img src={resolveMediaUrl(m.mediaUrl)} alt="" className="h-20 w-full object-cover" />
          )}
          {i === 0 && <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">Cover</span>}
          <div className="flex items-center justify-between bg-muted px-1">
            <button type="button" aria-label="Move earlier" disabled={busy || i === 0} onClick={() => move(i, -1)} className="p-0.5 disabled:opacity-30">
              <ArrowUp className="size-3.5 -rotate-90" />
            </button>
            <button type="button" aria-label="Remove" disabled={busy} onClick={() => remove(m)} className="p-0.5 hover:text-destructive disabled:opacity-30">
              <X className="size-3.5" />
            </button>
            <button type="button" aria-label="Move later" disabled={busy || i === ordered.length - 1} onClick={() => move(i, 1)} className="p-0.5 disabled:opacity-30">
              <ArrowDown className="size-3.5 -rotate-90" />
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
