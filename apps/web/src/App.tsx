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
import { TasksPage } from '@/pages/tasks-page';

const DashboardPage = lazy(() =>
  import('@/pages/dashboard-page').then((m) => ({ default: m.DashboardPage })),
);
const ImportsPage = lazy(() =>
  import('@/pages/imports-page').then((m) => ({ default: m.ImportsPage })),
);
const SettingsPage = lazy(() =>
  import('@/pages/settings-page').then((m) => ({ default: m.SettingsPage })),
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
const ConversionPagesPage = lazy(() =>
  import('@/pages/conversion-studio/conversion-pages-page').then((m) => ({
    default: m.ConversionPagesPage,
  })),
);
const CreateConversionPage = lazy(() =>
  import('@/pages/conversion-studio/create-conversion-page').then((m) => ({
    default: m.CreateConversionPage,
  })),
);
const ConversionPageEditorPage = lazy(() =>
  import('@/pages/conversion-studio/conversion-page-editor-page').then((m) => ({
    default: m.ConversionPageEditorPage,
  })),
);
const ConversionPageViewPage = lazy(() =>
  import('@/pages/conversion-studio/conversion-page-view-page').then((m) => ({
    default: m.ConversionPageViewPage,
  })),
);
const PublicConversionPage = lazy(() =>
  import('@/pages/conversion-studio/public-conversion-page').then((m) => ({
    default: m.PublicConversionPage,
  })),
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

      <Route
        path="/p/:slug"
        element={
          <LazyPage>
            <PublicConversionPage />
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
        <Route
          path="/pages/:id/view"
          element={
            <LazyPage>
              <ConversionPageViewPage />
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
          <Route path="search" element={<SearchPage />} />
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
            path="pages"
            element={
              <LazyPage>
                <ConversionPagesPage />
              </LazyPage>
            }
          />
          <Route
            path="pages/new"
            element={
              <LazyPage>
                <CreateConversionPage />
              </LazyPage>
            }
          />
          <Route
            path="pages/:id/edit"
            element={
              <LazyPage>
                <ConversionPageEditorPage />
              </LazyPage>
            }
          />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="campaigns/:id" element={<CampaignDetailPage />} />
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
