import { Outlet } from 'react-router-dom';

import { EmailVerificationBanner } from '@/components/email-verification-banner';
import { AppFooter } from './app-footer';
import { TopNav } from './top-nav';

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <EmailVerificationBanner />
      <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-6 lg:px-6 lg:py-8">
        <Outlet />
      </main>
      <AppFooter />
    </div>
  );
}
