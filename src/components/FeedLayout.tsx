import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { FollowSidebar } from './FollowSidebar';
import { SearchBar } from './SearchBar';
import { OfflineBanner } from './OfflineBanner';
import { BottomNav } from './BottomNav';
import { PullToRefresh } from './PullToRefresh';
import { usePageTitle } from '../hooks/usePageTitle';

const MAIN_ID = 'main-content';

export function FeedLayout() {
  usePageTitle(MAIN_ID);
  return (
    // content-start on phones: the grid is one column with two rows (top bar, page). With the
    // default stretch, a short page made both rows share the screen's spare height, which left a
    // big gap between the top bar and the feed. Desktop keeps one full-height row.
    <div className="grid min-h-screen grid-cols-1 content-start md:grid-cols-[auto_1fr_auto] md:content-stretch">
      {/* Keyboard users can jump past the navigation (WCAG 2.4.1). Visible only when focused. */}
      <a
        href={`#${MAIN_ID}`}
        className="sr-only z-[70] rounded-md bg-primary px-3 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to main content
      </a>
      <Sidebar />
      <main id={MAIN_ID} tabIndex={-1} className="min-w-0 outline-none">
        <OfflineBanner />
        {/* pb-28 on phones keeps the last post clear of the bottom bar. */}
        <div className="mx-auto w-full max-w-4xl px-6 pt-8 pb-28 md:pb-8">
          <Outlet />
        </div>
      </main>

      <div className="hidden w-70 shrink-0 pr-6 pb-6 lg:block">
        <div className="sticky top-0 flex max-h-[calc(100vh-1.5rem)] flex-col">
          {/* Space above the search bar — nudge this value to taste */}
          <div className="h-4" aria-hidden />
          <SearchBar />
          <div className="h-[45px]" aria-hidden />
          <FollowSidebar />
        </div>
      </div>
      {/* Same phone navigation as every other page; the feed used to be the one page without it. */}
      <BottomNav />
      <PullToRefresh />
    </div>
  );
}
