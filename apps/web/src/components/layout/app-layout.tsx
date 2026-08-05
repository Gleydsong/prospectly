import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { EmailVerificationBanner } from '@/components/email-verification-banner';
import { Header } from './header';
import { Sidebar } from './sidebar';

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="min-w-0 lg:pl-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <EmailVerificationBanner />
        <main className="mx-auto max-w-[1600px] p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
