import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, Camera, ImagePlus, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_IMAGE_MB, MAX_VIDEO_MB, canUseWebcam, mediaFileProblem } from '../utils/media';
import { WebcamCaptureDialog } from './WebcamCaptureDialog';
import { noRoomFor } from '../utils/storage';

/** Phones and tablets: the file input's `capture` opens the built-in camera app. */
function hasNativeCameraCapture(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
}

/**
 * Pick photos and videos for a catch before they're uploaded (FR-10): from the gallery, or
 * straight from the camera on phones. The order shown is the upload order; the first is the cover.
 */
export function MediaPicker({
  files,
  onChange,
  maxCount,
  idPrefix,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  /** How many more can be added to this catch. */
  maxCount: number;
  idPrefix: string;
}) {
  const [problems, setProblems] = useState<string[]>([]);
  const [webcam, setWebcam] = useState<'photo' | 'video' | null>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  const add = (picked: File[]) => {
    const errors: string[] = [];
    const ok: File[] = [];
    for (const f of picked) {
      const problem = mediaFileProblem(f);
      if (problem) errors.push(problem);
      else ok.push(f);
    }
    const room = Math.max(0, maxCount - files.length);
    if (ok.length > room) errors.push(`Only ${maxCount} photos and videos per catch — ${ok.length - room} not added.`);
    setProblems(errors);
    if (room > 0 && ok.length > 0) {
      const next = [...files, ...ok.slice(0, room)];
      onChange(next);
      // Warn now, not when Save fails: everything is kept on the device until it uploads.
      void noRoomFor(next).then((msg) => {
        if (msg) setProblems((prev) => [...prev, msg]);
      });
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const next = [...files];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    onChange(next);
  };

  const full = files.length >= maxCount;

  // Phones: native camera. Computers: the webcam dialog. Neither: plain file picker.
  const openCamera = (kind: 'photo' | 'video') => {
    if (!hasNativeCameraCapture() && canUseWebcam()) setWebcam(kind);
    else (kind === 'photo' ? photoRef : videoRef).current?.click();
  };

  const hiddenInput = (ref: React.RefObject<HTMLInputElement | null>, accept: string, capture?: 'environment') => (
    <input
      ref={ref}
      type="file"
      accept={accept}
      multiple={!capture}
      capture={capture}
      className="hidden"
      onChange={(e) => {
        add(Array.from(e.target.files ?? []));
        e.target.value = ''; // allow picking the same file again
      }}
    />
  );

  return (
    <div className="space-y-2" id={`${idPrefix}-media`}>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" disabled={full} onClick={() => galleryRef.current?.click()}>
          <ImagePlus className="size-4" /> Add photos/videos
        </Button>
        {/* Phones open the camera app; computers open the webcam dialog. */}
        <Button type="button" variant="outline" size="sm" disabled={full} onClick={() => openCamera('photo')}>
          <Camera className="size-4" /> Take photo
        </Button>
        <Button type="button" variant="outline" size="sm" disabled={full} onClick={() => openCamera('video')}>
          <Video className="size-4" /> Record video
        </Button>
        {hiddenInput(galleryRef, 'image/*,video/*')}
        {hiddenInput(photoRef, 'image/*', 'environment')}
        {hiddenInput(videoRef, 'video/*', 'environment')}
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        Photos up to {MAX_IMAGE_MB} MB, videos up to {MAX_VIDEO_MB} MB. The first one is the cover — use the arrows to reorder.
      </p>

      {webcam && (
        <WebcamCaptureDialog
          mode={webcam}
          maxVideoBytes={MAX_VIDEO_MB * 1024 * 1024}
          onCaptured={(file) => add([file])}
          onClose={() => setWebcam(null)}
        />
      )}

      {problems.map((p) => (
        <p key={p} className="m-0 text-xs text-destructive">{p}</p>
      ))}

      {files.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {files.map((f, i) => (
            <li key={`${f.name}-${f.size}-${f.lastModified}-${i}`} className="relative w-28 overflow-hidden rounded-md border border-border">
              {f.type.startsWith('video/') ? (
                <video src={previews[i]} className="h-20 w-full bg-black object-cover" muted />
              ) : (
                <img src={previews[i]} alt="" className="h-20 w-full object-cover" />
              )}
              {i === 0 && (
                <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">Cover</span>
              )}
              <div className="flex items-center justify-between bg-muted px-1">
                <button type="button" aria-label="Move earlier" disabled={i === 0} onClick={() => move(i, -1)} className="p-0.5 disabled:opacity-30">
                  <ArrowUp className="size-3.5 -rotate-90" />
                </button>
                <button type="button" aria-label="Remove" onClick={() => onChange(files.filter((_, j) => j !== i))} className="p-0.5 hover:text-destructive">
                  <X className="size-3.5" />
                </button>
                <button type="button" aria-label="Move later" disabled={i === files.length - 1} onClick={() => move(i, 1)} className="p-0.5 disabled:opacity-30">
                  <ArrowDown className="size-3.5 -rotate-90" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
