import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import type { DashboardSummary } from '../../types/dashboard';
import { locationsApi } from '../../api/locations';
import { profileApi } from '../../api/profile';
import { useInstallPrompt } from '../../hooks/useInstallPrompt';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const dismissKey = (userId: string) => `castjournal:getting-started-dismissed:${userId}`;

function readDismissed(userId: string): boolean {
  try {
    return localStorage.getItem(dismissKey(userId)) === '1';
  } catch {
    return false;
  }
}

function isInstalled(): boolean {
  return typeof window !== 'undefined'
    && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true);
}

interface Step {
  id: string;
  label: string;
  hint: string;
  done: boolean;
  to?: string;
  action?: () => void;
  actionLabel: string;
}

/**
 * First-time checklist (F-27): the few things that make CastJournal useful, ticked off from the
 * angler's real data. Hidden once everything is done, or when dismissed (remembered per angler
 * on this device).
 */
export function GettingStarted({ userId, summary }: { userId: string; summary: DashboardSummary }) {
  const [dismissed, setDismissed] = useState(() => readDismissed(userId));
  const [hasSpot, setHasSpot] = useState<boolean | null>(null);
  const [hasPhoto, setHasPhoto] = useState<boolean | null>(null);
  const install = useInstallPrompt();

  useEffect(() => {
    if (dismissed) return;
    let cancelled = false;
    locationsApi.getMine().then((l) => { if (!cancelled) setHasSpot(l.length > 0); }).catch(() => {});
    profileApi.getMine().then((p) => { if (!cancelled) setHasPhoto(!!p.avatarUrl); }).catch(() => {});
    return () => { cancelled = true; };
  }, [dismissed]);

  const installed = isInstalled();
  const steps: Step[] = [
    { id: 'spot', label: 'Save a fishing spot', hint: 'Pin where you fish; you can keep it private.', done: !!hasSpot, to: '/locations', actionLabel: 'Add spot' },
    { id: 'trip', label: 'Log your first trip', hint: 'Weather, moon and tides are filled in for you.', done: summary.tripCount > 0, to: '/trips/new', actionLabel: 'Log a trip' },
    { id: 'catch', label: 'Record a catch', hint: 'Species, size and a photo — works offline too.', done: summary.catchCount > 0, to: summary.tripCount > 0 ? '/trips' : '/trips/new', actionLabel: 'Add a catch' },
    { id: 'profile', label: 'Add a profile photo', hint: 'So other anglers recognise you.', done: !!hasPhoto, to: '/profile', actionLabel: 'Edit profile' },
    { id: 'share', label: 'Share a trip with the community', hint: 'Publish one trip; private spots stay hidden unless you allow it.', done: summary.publishedTripCount > 0, to: '/trips', actionLabel: 'Choose a trip' },
  ];
  // Installing is offered only where the browser can do it (or it's already installed).
  if (installed || install) {
    steps.push({ id: 'install', label: 'Install the app', hint: 'Opens like an app and works with no signal.', done: installed, action: install ? () => { void install(); } : undefined, actionLabel: 'Install' });
  }

  const loading = hasSpot === null || hasPhoto === null;
  const doneCount = steps.filter((s) => s.done).length;
  if (dismissed || loading || doneCount === steps.length) return null;

  const dismiss = () => {
    try { localStorage.setItem(dismissKey(userId), '1'); } catch { /* private mode */ }
    setDismissed(true);
  };
  const next = steps.find((s) => !s.done);

  return (
    <Card className="mb-6">
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="m-0 font-heading text-lg">Getting started</h2>
            <p className="m-0 text-sm text-muted-foreground">{doneCount} of {steps.length} done</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Hide the getting started checklist"
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Getting started progress"
          aria-valuemin={0}
          aria-valuemax={steps.length}
          aria-valuenow={doneCount}
        >
          <div className="h-full rounded-full bg-[color:var(--color-brass)] transition-all" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
        </div>

        <ol className="m-0 mt-4 list-none space-y-2 p-0">
          {steps.map((s) => (
            <li key={s.id} className={cn('flex items-center gap-3 rounded-lg p-2', s === next && 'bg-muted/50')}>
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border',
                  s.done ? 'border-transparent bg-emerald-500 text-white' : 'border-border',
                )}
                aria-hidden="true"
              >
                {s.done && <Check className="size-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className={cn('text-sm font-medium', s.done && 'text-muted-foreground line-through')}>
                  {s.label}<span className="sr-only">{s.done ? ' (done)' : ' (to do)'}</span>
                </div>
                {!s.done && <div className="text-xs text-muted-foreground">{s.hint}</div>}
              </div>
              {!s.done && (s.to ? (
                <Link to={s.to}><Button size="sm" variant={s === next ? 'default' : 'outline'}>{s.actionLabel}</Button></Link>
              ) : s.action ? (
                <Button size="sm" variant={s === next ? 'default' : 'outline'} onClick={s.action}>{s.actionLabel}</Button>
              ) : null)}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
