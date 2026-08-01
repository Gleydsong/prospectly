import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import type { ReactElement, ReactNode } from 'react';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';

const TEST_GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ||
  'test-google-client-id.apps.googleusercontent.com';

export type RenderWithProvidersOptions = Omit<RenderOptions, 'wrapper'> & {
  /** Initial MemoryRouter entries. Default: `['/']`. */
  initialEntries?: MemoryRouterProps['initialEntries'];
  /** Include GoogleOAuthProvider (needed when Google sign-in is mounted). Default: true. */
  withGoogle?: boolean;
  /** Custom QueryClient; a fresh one is created when omitted. */
  queryClient?: QueryClient;
};

function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

/**
 * Shared test render with QueryClient, router and optional Google OAuth provider.
 * Does not depend on CSS / viewport — use role queries that tolerate duplicated responsive markup.
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {},
): RenderResult & { queryClient: QueryClient } {
  const {
    initialEntries = ['/'],
    withGoogle = true,
    queryClient = createTestQueryClient(),
    ...renderOptions
  } = options;

  function Wrapper({ children }: { children: ReactNode }) {
    const tree = <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
    const withOauth = withGoogle ? (
      <GoogleOAuthProvider clientId={TEST_GOOGLE_CLIENT_ID}>{tree}</GoogleOAuthProvider>
    ) : (
      tree
    );
    return <QueryClientProvider client={queryClient}>{withOauth}</QueryClientProvider>;
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    queryClient,
  };
}
