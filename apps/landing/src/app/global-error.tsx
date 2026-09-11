'use client';

import { useEffect } from 'react';

import { LandingHtmlDocument } from '@/app/landing-html-document';
import { LandingRouteErrorScreen } from '@/components/landing-route-status';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <LandingHtmlDocument lang="pt-BR">
      <LandingRouteErrorScreen locale="pt" chrome="v2" onRetry={reset} />
    </LandingHtmlDocument>
  );
}
