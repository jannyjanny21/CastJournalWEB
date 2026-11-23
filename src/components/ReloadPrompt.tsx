import { useEffect } from 'react';
import { toast } from 'sonner';
import { useRegisterSW } from 'virtual:pwa-register/react';

/** Tells the angler when a new version is ready, instead of reloading under them (F-13). */
export function ReloadPrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError: () => { /* no service worker: the app still works online */ },
  });

  useEffect(() => {
    if (!needRefresh) return;
    toast('A new version of CastJournal is ready.', {
      duration: Infinity,
      action: { label: 'Reload', onClick: () => updateServiceWorker(true) },
      cancel: { label: 'Later', onClick: () => setNeedRefresh(false) },
    });
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  return null;
}
