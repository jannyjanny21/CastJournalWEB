const API_BASE_URL = import.meta.env.VITE_API_BASE_URL as string;

// Your API base ends in "/api" (e.g. https://castjournalapi.runasp.net/api),
// but uploaded files are served from the site root (https://castjournalapi.runasp.net/uploads/...),
// so strip the trailing "/api" before joining.
const ORIGIN = API_BASE_URL.replace(/\/api\/?$/, '');

export function resolveMediaUrl(mediaUrl: string): string {
  if (/^https?:\/\//i.test(mediaUrl)) return mediaUrl; // already absolute
  return `${ORIGIN}${mediaUrl.startsWith('/') ? '' : '/'}${mediaUrl}`;
}