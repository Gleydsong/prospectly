'use client';

import { useEffect } from 'react';

import { LandingRouteErrorScreen } from '@/components/landing-route-status';

export default function EnError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <LandingRouteErrorScreen locale="en" chrome="panel" onRetry={reset} />;
}
