/** Must match the server's limits (FileStorageSettings, CatchService.MaxMediaPerCatch). */
export const MAX_IMAGE_MB = 10;
export const MAX_VIDEO_MB = 25;
export const MAX_MEDIA_PER_CATCH = 10;

/** A reason the file can't be uploaded, or null when it's fine. The server checks again. */
export function mediaFileProblem(file: File): string | null {
  const isVideo = file.type.startsWith('video/');
  const isImage = file.type.startsWith('image/');
  if (!isVideo && !isImage) return `${file.name}: only photos and videos can be added.`;
  if (/heic|heif/i.test(file.type) || /\.(heic|heif)$/i.test(file.name))
    return `${file.name}: HEIC photos aren't supported. Set your camera to "Most Compatible" (JPEG) or take the photo here.`;
  const maxMb = isVideo ? MAX_VIDEO_MB : MAX_IMAGE_MB;
  if (file.size > maxMb * 1024 * 1024)
    return `${file.name}: ${isVideo ? 'videos' : 'photos'} can be at most ${maxMb} MB.`;
  return null;
}

/** True when this browser can open a webcam (needs HTTPS or localhost). */
export function canUseWebcam(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && !!navigator.mediaDevices?.getUserMedia;
}
