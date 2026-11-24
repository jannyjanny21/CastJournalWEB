import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { NotificationsProvider } from './context/NotificationsProvider';
import { Toaster } from './components/ui/sonner';
// Listen for the browser's install offer before anything renders.
import './hooks/useInstallPrompt';
import App from './App';
import { ReloadPrompt } from './components/ReloadPrompt';
import { OutboxSync } from './components/OutboxSync';
import { ConfirmProvider } from './components/ConfirmProvider';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <NotificationsProvider>
          <ConfirmProvider>
            <App />
            <Toaster position="bottom-right" richColors closeButton mobileOffset={{ bottom: 88 }} />
            <ReloadPrompt />
            <OutboxSync />
          </ConfirmProvider>
        </NotificationsProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
