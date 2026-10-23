import { lazy, Suspense, type ReactNode } from 'react';
import { Route, Routes } from 'react-router-dom';

import { AppLayout } from '@/components/layout/app-layout';
import { ProtectedRoute } from '@/components/protected-route';
import { RouteFallback } from '@/components/route-fallback';
import { ForgotPasswordPage } from '@/pages/auth/forgot-password-page';
import { LoginPage } from '@/pages/auth/login-page';
import { RegisterPage } from '@/pages/auth/register-page';
import { ResetPasswordPage } from '@/pages/auth/reset-password-page';
import { VerifyEmailPage } from '@/pages/auth/verify-email-page';
import { SupportPage } from '@/pages/support-page';
import { TasksPage } from '@/pages/tasks-page';
import { LegacyRedirect } from '@/components/legacy-redirect';
import {
  HomeDestination,
  ProspectDestination,
  ClientsDestination,
  ListsDestination,
  PipelineDestination,
} from '@/pages/navigation-pages';
import { WorkflowsPage } from '@/pages/workflows-page';

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
const CustomFieldsPage = lazy(() =>
  import('@/pages/custom-fields-page').then((m) => ({ default: m.CustomFieldsPage })),
);
const LeadDetailPage = lazy(() =>
  import('@/pages/leads/lead-detail-page').then((m) => ({ default: m.LeadDetailPage })),
);
const PersonaOnboardingPage = lazy(() =>
  import('@/pages/auth/persona-onboarding-page').then((m) => ({
    default: m.PersonaOnboardingPage,
  })),
);
const OauthConsentPage = lazy(() =>
  import('@/pages/oauth/oauth-consent-page').then((m) => ({ default: m.OauthConsentPage })),
);
const CampaignDetailPage = lazy(() =>
  import('@/pages/campaign-detail-page').then((m) => ({ default: m.CampaignDetailPage })),
);
const ResearchPage = lazy(() =>
  import('@/pages/sdr/research-page').then((m) => ({ default: m.ResearchPage })),
);
const SdrPage = lazy(() => import('@/pages/sdr/sdr-page').then((m) => ({ default: m.SdrPage })));
const AssistantSpikePage = lazy(() =>
  import('@/pages/assistant/assistant-spike-page').then((m) => ({ default: m.AssistantSpikePage })),
);
const NotFoundPage = lazy(() =>
  import('@/pages/not-found-page').then((m) => ({ default: m.NotFoundPage })),
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
          path="/oauth/consent"
          element={
            <LazyPage>
              <OauthConsentPage />
            </LazyPage>
          }
        />
        <Route
          path="/onboarding/persona"
          element={
            <LazyPage>
              <PersonaOnboardingPage />
            </LazyPage>
          }
        />
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
                <HomeDestination />
              </LazyPage>
            }
          />
          <Route path="prospectar" element={<ProspectDestination />} />
          <Route path="clientes" element={<ClientsDestination />} />
          <Route path="clientes/etapas" element={<PipelineDestination />} />
          <Route path="clientes/listas" element={<ListsDestination />} />
          <Route
            path="clientes/:id"
            element={
              <LazyPage>
                <LeadDetailPage />
              </LazyPage>
            }
          />
          <Route
            path="clientes/listas/:id"
            element={
              <LazyPage>
                <CampaignDetailPage />
              </LazyPage>
            }
          />
          <Route path="tools" element={<LegacyRedirect to="/prospectar" />} />
          <Route
            path="tools/opportunity-finder"
            element={<LegacyRedirect to="/prospectar?aba=servico" />}
          />
          <Route
            path="custom-fields"
            element={
              <LazyPage>
                <CustomFieldsPage />
              </LazyPage>
            }
          />
          <Route path="search" element={<LegacyRedirect to="/prospectar?aba=categoria" />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="imports" element={<LegacyRedirect to="/prospectar?aba=importar" />} />
          <Route path="leads" element={<LegacyRedirect to="/clientes" />} />
          <Route path="leads/:id" element={<LegacyRedirect to="/clientes/:id" />} />
          <Route path="pipeline" element={<LegacyRedirect to="/clientes/etapas" />} />
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
          <Route path="campaigns" element={<LegacyRedirect to="/clientes?vista=listas" />} />
          <Route path="campaigns/:id" element={<LegacyRedirect to="/clientes/listas/:id" />} />
          <Route
            path="sdr"
            element={
              <LazyPage>
                <SdrPage />
              </LazyPage>
            }
          />
          <Route
            path="sdr/research"
            element={
              <LazyPage>
                <ResearchPage />
              </LazyPage>
            }
          />
          <Route path="workflows" element={<WorkflowsPage />} />
          <Route path="reports" element={<LegacyRedirect to="/?aba=relatorios" />} />
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
          <Route
            path="assistant/spike"
            element={
              <LazyPage>
                <AssistantSpikePage />
              </LazyPage>
            }
          />
        </Route>
      </Route>

      <Route
        path="*"
        element={
          <LazyPage>
            <NotFoundPage />
          </LazyPage>
        }
      />
    </Routes>
  );
}
