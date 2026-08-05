import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { AppErrorBoundary } from './components/app-error-boundary';
import { LocaleSync } from './components/locale-sync';
import { ToastProvider } from './components/ui/toast';
import { GoogleAuthProvider } from './features/auth/google-auth-provider';
import { initObservability } from './lib/observability';
import { App } from './App';
import './i18n';
import './index.css';

initObservability();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <GoogleAuthProvider>
            <ToastProvider>
              <LocaleSync />
              <App />
            </ToastProvider>
          </GoogleAuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </AppErrorBoundary>
  </StrictMode>,
);
