import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { AppErrorBoundary } from './components/app-error-boundary';
import { LocaleSync } from './components/locale-sync';
import { ToastProvider } from './components/ui/toast';
import { GoogleAuthProvider } from './features/auth/google-auth-provider';
import { ThemeProvider } from './features/theme/theme-provider';
import { ensureI18n } from './i18n';
import { initObservability } from './lib/observability';
import { App } from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

async function bootstrap(): Promise<void> {
  await ensureI18n();
  initObservability();

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  createRoot(rootElement).render(
    <StrictMode>
      <AppErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <ThemeProvider>
              <GoogleAuthProvider>
                <ToastProvider>
                  <LocaleSync />
                  <App />
                </ToastProvider>
              </GoogleAuthProvider>
            </ThemeProvider>
          </BrowserRouter>
        </QueryClientProvider>
      </AppErrorBoundary>
    </StrictMode>,
  );
}

void bootstrap();
