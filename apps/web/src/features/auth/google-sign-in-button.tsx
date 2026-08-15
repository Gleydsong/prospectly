import { lazy, Suspense } from 'react';

import type { AuthResponse } from '@/features/auth/api';
import { resolveGoogleClientId } from '@/lib/public-env';

export type GoogleSignInButtonProps = {
  onSuccess: (response: AuthResponse) => void | Promise<void>;
  onError?: (message: string) => void;
  /** Required for first-time Google signup (register page). */
  acceptTerms?: boolean;
  organizationName?: string;
  locale?: 'pt' | 'en';
  disabled?: boolean;
};

const GoogleSignInChunk = lazy(() =>
  import('./google-sign-in-chunk').then((mod) => ({ default: mod.GoogleSignInChunk })),
);

export function GoogleSignInButton(props: GoogleSignInButtonProps) {
  const clientId = resolveGoogleClientId();
  if (!clientId) {
    return null;
  }
  return (
    <Suspense fallback={null}>
      <GoogleSignInChunk {...props} clientId={clientId} />
    </Suspense>
  );
}
