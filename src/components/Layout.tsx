import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function Layout() {
  return (
    // flex-col on mobile so the Sidebar's mobile top bar stacks above <main>
    // instead of sitting beside it; md:flex-row restores the sidebar-left
    // layout on desktop, same as before.
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar />
      {/* Wide on desktop for dashboards, tables and maps. Forms and reading pages (trip/catch forms,
          trip detail, profile, export) cap their own width, so they stay comfortable to read. */}
      <main className="mx-auto w-full min-w-0 max-w-6xl px-6 py-8 xl:px-10">
        <Outlet />
      </main>
    </div>
  );
}
