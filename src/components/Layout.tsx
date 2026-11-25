import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { OfflineBanner } from './OfflineBanner';
import { BottomNav } from './BottomNav';
import { PullToRefresh } from './PullToRefresh';
import { usePageTitle } from '../hooks/usePageTitle';

const MAIN_ID = 'main-content';

export function Layout() {
  usePageTitle(MAIN_ID);
  return (
    // flex-col on mobile so the Sidebar's mobile top bar stacks above <main>
    // instead of sitting beside it; md:flex-row restores the sidebar-left
    // layout on desktop, same as before.
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Keyboard users can jump past the navigation (WCAG 2.4.1). Visible only when focused. */}
      <a
        href={`#${MAIN_ID}`}
        className="sr-only z-[70] rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>
      <Sidebar />
      {/* Wide on desktop for dashboards, tables and maps. Forms and reading pages (trip/catch forms,
          trip detail, profile, export) cap their own width, so they stay comfortable to read. */}
      {/* The offline strip sits above <main>, not inside it: PageHeader pulls itself up to the top of
          <main> (negative margin + sticky), which would otherwise slide over the banner. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <OfflineBanner />
        {/* pb-28 on phones keeps the last content clear of the bottom bar. */}
        <main id={MAIN_ID} tabIndex={-1} className="mx-auto w-full min-w-0 max-w-6xl px-6 pt-8 pb-28 outline-none md:pb-8 xl:px-10">
          <Outlet />
        </main>
      </div>
      <BottomNav />
      <PullToRefresh />
    </div>
  );
}
