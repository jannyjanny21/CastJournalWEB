import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ViewerItem } from '../utils/viewer';

/**
 * Full-screen photo/video viewer (F-27). Arrow keys or swipe to move between items, Escape or
 * the × to close. Videos pause when you move away from them.
 */
export function MediaViewer({ items, index, onIndexChange, onClose }: {
  items: ViewerItem[];
  /** Which item is open; null = closed. */
  index: number | null;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const open = index != null && items.length > 0;
  const i = open ? Math.min(Math.max(index, 0), items.length - 1) : 0;
  const item = open ? items[i] : null;
  const closeRef = useRef<HTMLButtonElement>(null);
  const [touchX, setTouchX] = useState<number | null>(null);

  const go = (delta: number) => {
    if (items.length < 2) return;
    onIndexChange((i + delta + items.length) % items.length);
  };

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); if (items.length > 1) onIndexChange((i + 1) % items.length); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); if (items.length > 1) onIndexChange((i - 1 + items.length) % items.length); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, i, items.length, onClose, onIndexChange]);

  if (!open || !item) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Photo and video viewer, ${i + 1} of ${items.length}`}
      className="fixed inset-0 z-[60] flex flex-col bg-black/95 text-white"
      onClick={onClose}
      onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX == null) return;
        const dx = e.changedTouches[0].clientX - touchX;
        setTouchX(null);
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      <div className="flex items-center justify-between gap-3 p-3 text-sm" onClick={(e) => e.stopPropagation()}>
        <span className="tabular-nums text-white/70">{items.length > 1 ? `${i + 1} / ${items.length}` : ''}</span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close viewer"
          className="rounded-full p-2 text-white/80 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white"
        >
          <X className="size-6" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-16">
        {item.type === 'Video' ? (
          // Keyed so moving to another item stops this video.
          <video
            key={item.id}
            src={item.url}
            controls
            autoPlay
            playsInline
            className="max-h-full max-w-full"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <img
            key={item.id}
            src={item.url}
            alt={item.caption ?? 'Catch photo'}
            className="max-h-full max-w-full select-none object-contain"
            draggable={false}
            onClick={(e) => e.stopPropagation()}
          />
        )}

        {items.length > 1 && (
          <>
            <NavButton side="left" onClick={() => go(-1)} />
            <NavButton side="right" onClick={() => go(1)} />
          </>
        )}
      </div>

      {item.caption && (
        <p className="m-0 p-4 text-center text-sm text-white/80" onClick={(e) => e.stopPropagation()}>{item.caption}</p>
      )}
    </div>,
    document.body,
  );
}

function NavButton({ side, onClick }: { side: 'left' | 'right'; onClick: () => void }) {
  const Icon = side === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      aria-label={side === 'left' ? 'Previous' : 'Next'}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className={cn(
        'absolute top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white sm:block',
        side === 'left' ? 'left-3' : 'right-3',
      )}
    >
      <Icon className="size-7" />
    </button>
  );
}
