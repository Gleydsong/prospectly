import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from '@/components/layout/app-layout';
import { ProtectedRoute } from '@/components/protected-route';
import { RouteFallback } from '@/components/route-fallback';
import { ForgotPasswordPage } from '@/pages/auth/forgot-password-page';
import { LoginPage } from '@/pages/auth/login-page';
import { RegisterPage } from '@/pages/auth/register-page';
import { ResetPasswordPage } from '@/pages/auth/reset-password-page';
import { VerifyEmailPage } from '@/pages/auth/verify-email-page';
import { CampaignDetailPage } from '@/pages/campaign-detail-page';
import { CampaignsPage } from '@/pages/campaigns-page';
import { LeadDetailPage } from '@/pages/leads/lead-detail-page';
import { LeadsPage } from '@/pages/leads/leads-page';
import { PipelinePage } from '@/pages/pipeline-page';
import { SearchPage } from '@/pages/search-page';
import { SupportPage } from '@/pages/support-page';
import { TasksPage } from '@/pages/tasks-page';
import { ReportsPage } from '@/pages/reports-page';
import { WorkflowsPage } from '@/pages/workflows-page';

const DashboardPage = lazy(() =>
  import('@/pages/dashboard-page').then((m) => ({ default: m.DashboardPage })),
);
const ImportsPage = lazy(() =>
  import('@/pages/imports-page').then((m) => ({ default: m.ImportsPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/settings-page').then((m) => ({ default: m.SettingsPage })),
);
const CreditsPage = lazy(() =>
  import('@/pages/credits-page').then((m) => ({ default: m.CreditsPage })),
);
const SettingsPrivacyPage = lazy(() =>
  import('@/pages/settings-privacy-page').then((m) => ({ default: m.SettingsPrivacyPage })),
);
const PixCheckoutPage = lazy(() =>
  import('@/pages/billing/pix-checkout-page').then((m) => ({ default: m.PixCheckoutPage })),
);
const BillingSuccessPage = lazy(() =>
  import('@/pages/billing-result-page').then((m) => ({ default: m.BillingSuccessPage })),
);
const BillingCancelPage = lazy(() =>
  import('@/pages/billing-result-page').then((m) => ({ default: m.BillingCancelPage })),
);
const AgentsPage = lazy(() =>
  import('@/pages/agents/agents-page').then((m) => ({ default: m.AgentsPage })),
);
const AgentsCrmPage = lazy(() =>
  import('@/pages/agents/agents-crm-page').then((m) => ({ default: m.AgentsCrmPage })),
);
const AgentsWhatsappPage = lazy(() =>
  import('@/pages/agents/agents-whatsapp-page').then((m) => ({ default: m.AgentsWhatsappPage })),
);
const ToolsPage = lazy(() => import('@/pages/tools-page').then((m) => ({ default: m.ToolsPage })));
const CustomFieldsPage = lazy(() =>
  import('@/pages/custom-fields-page').then((m) => ({ default: m.CustomFieldsPage })),
);
const OpportunityFinderPage = lazy(() =>
  import('@/pages/opportunity-finder-page').then((m) => ({ default: m.OpportunityFinderPage })),
);

function LazyPage({ children }: { children: ReactNode }) {
  return <Suspense fallback={<RouteFallback />}>{children}</Suspense>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route
        path="/billing/success"
        element={
          <LazyPage>
            <BillingSuccessPage />
          </LazyPage>
        }
      />
      <Route
        path="/billing/cancel"
        element={
          <LazyPage>
            <BillingCancelPage />
          </LazyPage>
        }
      />

      <Route element={<ProtectedRoute />}>
        <Route
          path="/billing/pix"
          element={
            <LazyPage>
              <PixCheckoutPage />
            </LazyPage>
          }
        />
        <Route element={<AppLayout />}>
          <Route
            index
            element={
              <LazyPage>
                <DashboardPage />
              </LazyPage>
            }
          />
          <Route
            path="tools"
            element={
              <LazyPage>
                <ToolsPage />
              </LazyPage>
            }
          />
          <Route
            path="tools/opportunity-finder"
            element={
              <LazyPage>
                <OpportunityFinderPage />
              </LazyPage>
            }
          />
          <Route
            path="custom-fields"
            element={
              <LazyPage>
                <CustomFieldsPage />
              </LazyPage>
            }
          />
          <Route path="search" element={<SearchPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route
            path="imports"
            element={
              <LazyPage>
                <ImportsPage />
              </LazyPage>
            }
          />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="leads/:id" element={<LeadDetailPage />} />
          <Route path="pipeline" element={<PipelinePage />} />
          <Route
            path="agents"
            element={
              <LazyPage>
                <AgentsPage />
              </LazyPage>
            }
          />
          <Route
            path="agents/crm"
            element={
              <LazyPage>
                <AgentsCrmPage />
              </LazyPage>
            }
          />
          <Route
            path="agents/whatsapp"
            element={
              <LazyPage>
                <AgentsWhatsappPage />
              </LazyPage>
            }
          />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="campaigns/:id" element={<CampaignDetailPage />} />
          <Route path="workflows" element={<WorkflowsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route
            path="credits"
            element={
              <LazyPage>
                <CreditsPage />
              </LazyPage>
            }
          />
          <Route
            path="settings"
            element={
              <LazyPage>
                <SettingsPage />
              </LazyPage>
            }
          />
          <Route
            path="settings/privacy"
            element={
              <LazyPage>
                <SettingsPrivacyPage />
              </LazyPage>
            }
          />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
