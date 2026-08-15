import type { ReactNode } from 'react';

/**
 * Pass-through. Google Identity Services is loaded with the sign-in button
 * so `@react-oauth/google` stays out of the initial JS chunk.
 */
export function GoogleAuthProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
