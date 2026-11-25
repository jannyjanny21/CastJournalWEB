import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';

/** How far (px) the finger must pull before letting go refreshes. */
const THRESHOLD = 70;
/** The indicator never travels further than this, however far the finger goes. */
const MAX_PULL = 110;

/**
 * Pull down to refresh, for the installed app only. Browsers turn their own pull-to-refresh off in
 * an installed PWA (iOS has none at all), so without this the only way to refresh is to close and
 * reopen the app. In a normal browser tab the browser's own gesture is left alone.
 */
function isInstalled(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Forms autosave a draft, but the last keystrokes may not be stored yet: don't reload there. */
function isFormPage(pathname: string): boolean {
  return /\/(new|edit)$/.test(pathname);
}

/** Would this touch scroll or pan something instead of the page? Then it isn't a pull. */
function blockedByTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  // Maps pan when dragged down; dialogs and sheets have their own scrolling.
  if (target.closest('.leaflet-container, [role="dialog"], [role="alertdialog"], [data-no-pull-refresh]')) return true;
  // A scrolled list or panel inside the page: dragging down scrolls it back first.
  for (let el: Element | null = target; el && el !== document.body; el = el.parentElement) {
    if (el.scrollTop > 0) {
      const overflowY = getComputedStyle(el).overflowY;
      if (overflowY === 'auto' || overflowY === 'scroll') return true;
    }
  }
  return false;
}

function anyDialogOpen(): boolean {
  return !!document.querySelector('[role="dialog"], [role="alertdialog"]');
}

/**
 * Reloads the app. If a new version has been deployed, installs it first: the angler asked for a
 * refresh, so there's no half-filled form to protect (form pages never get here). Unsent trips and
 * drafts live in IndexedDB and survive the reload.
 */
async function refreshApp() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg && navigator.onLine) {
      // Look for a new version, but don't keep the angler waiting on a slow connection.
      await Promise.race([reg.update().catch(() => {}), new Promise((r) => setTimeout(r, 2500))]);
      if (reg.waiting) {
        navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), { once: true });
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        // In case the new version doesn't take over, reload anyway.
        setTimeout(() => window.location.reload(), 3000);
        return;
      }
    }
  } catch {
    // No service worker (e.g. local dev): a plain reload is fine.
  }
  window.location.reload();
}

export function PullToRefresh() {
  const { pathname } = useLocation();
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const active = useRef(false);
  const pullRef = useRef(0);

  const enabled = isInstalled() && !isFormPage(pathname);

  useEffect(() => {
    if (!enabled) return;

    const setDistance = (d: number) => {
      pullRef.current = d;
      setPull(d);
    };

    const onStart = (e: TouchEvent) => {
      active.current = false;
      start.current = null;
      if (refreshing || e.touches.length !== 1) return;
      if ((document.scrollingElement?.scrollTop ?? window.scrollY) > 0) return;
      if (anyDialogOpen() || blockedByTarget(e.target)) return;
      start.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };

    const onMove = (e: TouchEvent) => {
      if (!start.current) return;
      const dy = e.touches[0].clientY - start.current.y;
      const dx = e.touches[0].clientX - start.current.x;
      if (!active.current) {
        // Decide once: a mostly-downward drag from the top is a pull; anything else is left alone.
        if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return;
        if (dy <= 0 || Math.abs(dx) > dy) {
          start.current = null;
          return;
        }
        active.current = true;
        setDragging(true);
      }
      // Resistance: the indicator moves about half as far as the finger.
      setDistance(Math.min(MAX_PULL, Math.max(0, dy * 0.5)));
      if (e.cancelable) e.preventDefault(); // keep iOS from rubber-banding the page at the same time
    };

    const onEnd = () => {
      const wasActive = active.current;
      start.current = null;
      active.current = false;
      if (!wasActive) return;
      setDragging(false);
      if (pullRef.current >= THRESHOLD) {
        setRefreshing(true);
        setDistance(THRESHOLD);
        void refreshApp();
      } else {
        setDistance(0);
      }
    };

    // touchmove must not be passive, or preventDefault is ignored.
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd, { passive: true });
    window.addEventListener('touchcancel', onEnd, { passive: true });
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled, refreshing]);

  if (!enabled || (pull === 0 && !refreshing)) return null;

  const ready = pull >= THRESHOLD;
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
      style={{ transform: `translateY(${pull - 44}px)`, transition: dragging ? 'none' : 'transform 0.2s ease-out' }}
      aria-hidden={!refreshing}
    >
      <div className="mt-[env(safe-area-inset-top)] flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-xs shadow-md">
        <RefreshCw
          className={`size-4 text-primary ${refreshing ? 'animate-spin' : ''}`}
          style={refreshing ? undefined : { transform: `rotate(${(pull / THRESHOLD) * 270}deg)` }}
        />
        <span role={refreshing ? 'status' : undefined}>
          {refreshing ? 'Refreshing…' : ready ? 'Release to refresh' : 'Pull to refresh'}
        </span>
      </div>
    </div>
  );
}
