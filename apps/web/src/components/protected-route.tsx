import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { bootstrapSession } from '@/lib/api';
import { useAuthStore } from '@/stores/auth.store';

export function ProtectedRoute() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const location = useLocation();
  const [ready, setReady] = useState(() => useAuthStore.getState().bootstrapped);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!useAuthStore.getState().bootstrapped) {
        await bootstrapSession();
      } else {
        useAuthStore.getState().setBootstrapped(true);
      }
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm text-zinc-400">
        A carregar…
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
