import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@/components/layout/app-layout';
import { ProtectedRoute } from '@/components/protected-route';
import { LoginPage } from '@/pages/auth/login-page';
import { RegisterPage } from '@/pages/auth/register-page';
import { DashboardPage } from '@/pages/dashboard-page';
import { ImportsPage } from '@/pages/imports-page';
import { LeadDetailPage } from '@/pages/leads/lead-detail-page';
import { LeadsPage } from '@/pages/leads/leads-page';
import { PipelinePage } from '@/pages/pipeline-page';
import { SearchPage } from '@/pages/search-page';
import { SettingsPage } from '@/pages/settings-page';
import { TasksPage } from '@/pages/tasks-page';

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="imports" element={<ImportsPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="leads/:id" element={<LeadDetailPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
