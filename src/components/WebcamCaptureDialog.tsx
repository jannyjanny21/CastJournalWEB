import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Circle, RotateCcw, Square } from 'lucide-react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

type Mode = 'photo' | 'video';
type Status = 'starting' | 'live' | 'recording' | 'review' | 'error';

/** Recording stops by itself at this length, or just before the size limit. */
const MAX_SECONDS = 60;
const VIDEO_BITS_PER_SECOND = 2_500_000;

/** Best format this browser can record: MP4 where supported (Safari, newer Chrome), otherwise WebM. */
function pickVideoType(): { mimeType: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = [
    { mimeType: 'video/mp4;codecs=avc1', ext: 'mp4' },
    { mimeType: 'video/mp4', ext: 'mp4' },
    { mimeType: 'video/webm;codecs=vp9,opus', ext: 'webm' },
    { mimeType: 'video/webm;codecs=vp8,opus', ext: 'webm' },
    { mimeType: 'video/webm', ext: 'webm' },
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c.mimeType)) ?? null;
}

function cameraErrorMessage(err: unknown): string {
  const name = err && typeof err === 'object' && 'name' in err ? String((err as { name: unknown }).name) : '';
  if (name === 'NotAllowedError' || name === 'SecurityError')
    return 'Camera access was blocked. Allow the camera for this site in your browser (the camera icon in the address bar), then try again.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No camera was found on this device.';
  if (name === 'NotReadableError') return 'The camera is being used by another app. Close it and try again.';
  return "Couldn't start the camera.";
}

/**
 * Take a photo or record a video with the computer's webcam (F-17). Mounted only while open,
 * so each opening starts fresh. Phones use the native camera instead (see MediaPicker).
 */
export function WebcamCaptureDialog({
  mode,
  maxVideoBytes,
  onCaptured,
  onClose,
}: {
  mode: Mode;
  maxVideoBytes: number;
  onCaptured: (file: File) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<Status>('starting');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ file: File; url: string } | null>(null);
  const [seconds, setSeconds] = useState(0);

  const streamRef = useRef<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Attach the stream whenever the <video> element mounts (the dialog renders in a portal).
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
    if (el && streamRef.current && el.srcObject !== streamRef.current) el.srcObject = streamRef.current;
  }, []);

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: mode === 'video',
      })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoElRef.current) videoElRef.current.srcObject = stream;
        setStatus('live');
      })
      .catch((err) => {
        if (cancelled) return;
        setError(cameraErrorMessage(err));
        setStatus('error');
      });

    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorderRef.current && recorderRef.current.state !== 'inactive') {
        recorderRef.current.ondataavailable = null;
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [mode]);

  // Free the preview URL of a discarded capture.
  useEffect(() => () => { if (result) URL.revokeObjectURL(result.url); }, [result]);

  const stamp = () => new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  const takePhoto = () => {
    const video = videoElRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setError("Couldn't capture the photo — try again.");
          return;
        }
        const file = new File([blob], `photo-${stamp()}.jpg`, { type: 'image/jpeg' });
        setResult({ file, url: URL.createObjectURL(file) });
        setStatus('review');
      },
      'image/jpeg',
      0.9
    );
  };

  const startRecording = () => {
    const stream = streamRef.current;
    const type = pickVideoType();
    if (!stream || !type) {
      setError("This browser can't record video. Try Chrome or Edge, or upload a video file instead.");
      return;
    }

    const chunks: Blob[] = [];
    let size = 0;
    const recorder = new MediaRecorder(stream, { mimeType: type.mimeType, videoBitsPerSecond: VIDEO_BITS_PER_SECOND });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size === 0) return;
      chunks.push(e.data);
      size += e.data.size;
      // Leave headroom under the server's limit.
      if (size > maxVideoBytes * 0.92 && recorder.state === 'recording') recorder.stop();
    };
    recorder.onstop = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      const blob = new Blob(chunks, { type: type.mimeType.split(';')[0] });
      const file = new File([blob], `video-${stamp()}.${type.ext}`, { type: blob.type });
      setResult({ file, url: URL.createObjectURL(file) });
      setStatus('review');
    };

    recorder.start(1000); // a chunk every second, so the size check runs while recording
    setSeconds(0);
    setStatus('recording');
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS && recorder.state === 'recording') recorder.stop();
        return s + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const retake = () => {
    setResult(null);
    setSeconds(0);
    setStatus('live');
  };

  const use = () => {
    if (!result) return;
    onCaptured(result.file);
    onClose();
  };

  const showLive = status === 'starting' || status === 'live' || status === 'recording';

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === 'photo' ? 'Take a photo' : 'Record a video'}</DialogTitle>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-lg bg-black">
          {/* Live view is mirrored like a mirror; the saved photo/video is not. */}
          <video
            ref={attachVideo}
            autoPlay
            playsInline
            muted
            className={showLive ? 'aspect-video w-full -scale-x-100 object-contain' : 'hidden'}
          />
          {status === 'review' && result && (
            mode === 'photo'
              ? <img src={result.url} alt="Captured" className="aspect-video w-full object-contain" />
              : <video src={result.url} controls className="aspect-video w-full object-contain" />
          )}
          {status === 'starting' && (
            <p className="absolute inset-0 m-0 flex items-center justify-center text-sm text-white/80">Starting camera…</p>
          )}
          {status === 'error' && (
            <p className="m-0 flex aspect-video items-center justify-center p-6 text-center text-sm text-white/90">{error}</p>
          )}
          {status === 'recording' && (
            <span className="absolute left-2 top-2 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-xs text-white">
              <Circle className="size-2.5 fill-red-500 text-red-500" />
              {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')} / {Math.floor(MAX_SECONDS / 60)}:00
            </span>
          )}
        </div>

        {error && status !== 'error' && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>

          {mode === 'photo' && status === 'live' && (
            <Button type="button" onClick={takePhoto}><Camera className="size-4" /> Capture</Button>
          )}
          {mode === 'video' && status === 'live' && (
            <Button type="button" onClick={startRecording}><Circle className="size-4 fill-current" /> Start recording</Button>
          )}
          {status === 'recording' && (
            <Button type="button" variant="destructive" onClick={stopRecording}><Square className="size-4 fill-current" /> Stop</Button>
          )}
          {status === 'review' && (
            <>
              <Button type="button" variant="outline" onClick={retake}><RotateCcw className="size-4" /> Retake</Button>
              <Button type="button" onClick={use}>Use {mode === 'photo' ? 'photo' : 'video'}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
