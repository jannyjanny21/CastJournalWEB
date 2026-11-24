import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LayoutGrid, Plus, Sailboat, Map as MapIcon, Fish, NotebookPen, CloudUpload } from 'lucide-react';
import type { Trip } from '../types/trip';
import { tripsApi } from '../api/trips';
import { isStillFishing, tripHeading, formatTripDates } from '../utils/trip';
import { QuickCatchDialog, type QuickCatchTarget } from './QuickCatchDialog';
import { useOutbox } from '../offline/outbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const LEFT = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/feed', label: 'Feed', icon: LayoutGrid },
];
const RIGHT = [
  { to: '/trips', label: 'My Trips', icon: Sailboat },
  { to: '/map', label: 'Map', icon: MapIcon },
];

const itemClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    'flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] no-underline transition-colors',
    isActive ? 'text-[color:var(--color-brass)] font-medium' : 'text-muted-foreground hover:text-foreground',
  );

/**
 * Phone navigation within thumb reach (F-27): Home · Feed · + · My Trips · Map. The "+" logs a
 * trip, or adds a quick catch to a trip you're still fishing. The sidebar menu still holds the rest.
 */
export function BottomNav() {
  const navigate = useNavigate();
  const [chooserOpen, setChooserOpen] = useState(false);
  const [active, setActive] = useState<Trip[] | null>(null);
  const [catchFor, setCatchFor] = useState<QuickCatchTarget | null>(null);
  // Trips logged offline that haven't uploaded yet can take catches too; they upload together.
  const { entries } = useOutbox();
  const queued = entries.filter((e) => e.kind !== 'catch' && !e.serverTripId && e.status !== 'failed' && isStillFishing(e.trip));

  const openPlus = async () => {
    setChooserOpen(true);
    setActive(null);
    try {
      // Saved for offline reading, so this works with no signal too.
      const res = await tripsApi.getMine({ page: 1, pageSize: 10 });
      setActive(res.items.filter(isStillFishing));
    } catch {
      setActive([]);
    }
  };

  const go = (path: string) => {
    setChooserOpen(false);
    navigate(path);
  };

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_8px_rgb(0_0_0/0.06)] backdrop-blur md:hidden"
      >
        {LEFT.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={itemClass}>
            <Icon className="size-5" /> {label}
          </NavLink>
        ))}
        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            onClick={openPlus}
            aria-label="Log a trip or a catch"
            className="-mt-5 flex size-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-background transition-transform active:scale-95"
          >
            <Plus className="size-6" />
          </button>
        </div>
        {RIGHT.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/trips'} className={itemClass}>
            <Icon className="size-5" /> {label}
          </NavLink>
        ))}
      </nav>

      <Dialog open={chooserOpen} onOpenChange={setChooserOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>What are you logging?</DialogTitle>
            <DialogDescription>Both work offline; they upload when you're back online.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {active?.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setChooserOpen(false); setCatchFor({ kind: 'saved', trip: t }); }}
                className="flex items-center gap-3 rounded-lg border border-[color:var(--color-brass)]/50 p-3 text-left hover:bg-muted"
              >
                <Fish className="size-5 shrink-0 text-[color:var(--color-brass)]" />
                <span className="min-w-0">
                  <strong className="block truncate text-sm">Add a catch to {tripHeading(t)}</strong>
                  <span className="text-xs text-muted-foreground">Still fishing · {formatTripDates(t)}</span>
                </span>
              </button>
            ))}
            {queued.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => { setChooserOpen(false); setCatchFor({ kind: 'queued', entry: e }); }}
                className="flex items-center gap-3 rounded-lg border border-dashed border-[color:var(--color-brass)]/50 p-3 text-left hover:bg-muted"
              >
                <Fish className="size-5 shrink-0 text-[color:var(--color-brass)]" />
                <span className="min-w-0">
                  <strong className="block truncate text-sm">Add a catch to {e.trip.title || 'your trip'}</strong>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <CloudUpload className="size-3.5" /> On this device, not uploaded yet · {formatTripDates(e.trip)}
                  </span>
                </span>
              </button>
            ))}
            {active === null && <p className="m-0 text-xs text-muted-foreground">Checking for a trip in progress…</p>}
            <button
              type="button"
              onClick={() => go('/trips/new')}
              className="flex items-center gap-3 rounded-lg border border-border p-3 text-left hover:bg-muted"
            >
              <NotebookPen className="size-5 shrink-0 text-muted-foreground" />
              <span>
                <strong className="block text-sm">Log a new trip</strong>
                <span className="text-xs text-muted-foreground">Date, spot, conditions and catches</span>
              </span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {catchFor && (
        <QuickCatchDialog
          target={catchFor}
          open
          onOpenChange={(o) => { if (!o) setCatchFor(null); }}
        />
      )}
    </>
  );
}
