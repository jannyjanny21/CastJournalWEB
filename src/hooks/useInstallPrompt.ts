import { useSyncExternalStore } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/*
 * The browser offers installing once per page load, sometimes before React has drawn anything
 * (e.g. while the login page is showing). Catch it here, at start-up, and keep it outside any
 * component, so the Sidebar can be re-drawn (moving between pages) without losing it.
 */
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // show our own button instead of the browser's mini-infobar
    deferred = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

async function install() {
  const event = deferred;
  if (!event) return;
  await event.prompt();
  await event.userChoice;
  // The offer can only be used once, whatever the answer; the browser offers again later.
  deferred = null;
  notify();
}

/**
 * The browser's "install this app" offer (Chrome, Edge, Android). Null when it isn't available:
 * already installed, or a browser like Safari that installs through Share → Add to Home Screen.
 */
export function useInstallPrompt(): (() => Promise<void>) | null {
  const available = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  return available ? install : null;
}
