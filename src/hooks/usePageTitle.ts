import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

// Most specific first. A trip's own title replaces "Trip" once it loads (TripDetail sets it).
const TITLES: [RegExp, string][] = [
  [/^\/dashboard/, 'Dashboard'],
  [/^\/feed/, 'Feed'],
  [/^\/trips\/new/, 'Log a trip'],
  [/^\/trips\/deleted/, 'Recently deleted'],
  [/^\/trips\/[^/]+\/edit/, 'Edit trip'],
  [/^\/trips\/[^/]+\/catches\/new/, 'Add a catch'],
  [/^\/trips\/[^/]+/, 'Trip'],
  [/^\/trips/, 'My Trips'],
  [/^\/map/, 'My Map'],
  [/^\/catches\/[^/]+\/edit/, 'Edit catch'],
  [/^\/catches\/[^/]+/, 'Catch'],
  [/^\/catches/, 'My Catches'],
  [/^\/locations/, 'Locations'],
  [/^\/analytics/, 'My Stats'],
  [/^\/export/, 'Export'],
  [/^\/profile/, 'My profile'],
  [/^\/anglers\//, 'Angler'],
  [/^\/notifications/, 'Notifications'],
  [/^\/species\/requests/, 'Species requests'],
  [/^\/admin\/users/, 'Users · Admin'],
  [/^\/admin\/species/, 'Species · Admin'],
  [/^\/admin\/categories/, 'Categories · Admin'],
  [/^\/admin\/moderation/, 'Moderation · Admin'],
  [/^\/admin\/reports/, 'Reports · Admin'],
  [/^\/admin\/audit-logs/, 'Audit log · Admin'],
  [/^\/admin\/backup/, 'Backup · Admin'],
  [/^\/admin/, 'Admin'],
];

export function titleFor(path: string): string {
  return TITLES.find(([re]) => re.test(path))?.[1] ?? 'CastJournal';
}

export function setPageTitle(title: string) {
  document.title = title === 'CastJournal' ? title : `${title} · CastJournal`;
}

/**
 * WCAG 2.4.2 / 2.4.3: each page gets its own tab title, and after moving to another page keyboard
 * focus goes to the main content, so screen readers announce the new page instead of staying on
 * the link that was clicked. (Not on the first load, and not for #hash links within a page.)
 */
export function usePageTitle(mainId: string) {
  const { pathname } = useLocation();
  const first = useRef(true);

  useEffect(() => {
    setPageTitle(titleFor(pathname));
    if (first.current) {
      first.current = false;
      return;
    }
    const main = document.getElementById(mainId);
    main?.focus({ preventScroll: true });
  }, [pathname, mainId]);
}
