import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { LocaleSync } from './components/locale-sync';
import { GoogleAuthProvider } from './features/auth/google-auth-provider';
import { App } from './App';
import './i18n';
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

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <GoogleAuthProvider>
          <LocaleSync />
          <App />
        </GoogleAuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
