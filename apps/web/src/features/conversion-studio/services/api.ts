import { api } from '@/lib/api';
import type { PaginatedResult } from '@/types';

export type ConversionPageStatus = 'DRAFT' | 'PREVIEW' | 'PUBLISHED' | 'ARCHIVED';
export type ConversionPageTemplate = 'HTML' | 'AURORA';

export type ConversionGenerationStatus =
  | 'IDLE'
  | 'QUEUED'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED';

export interface ConversionPageSummary {
  id: string;
  title: string;
  status: ConversionPageStatus;
  publicSlug: string;
  leadId?: string | null;
  publishedVersion?: number | null;
  draftRevision: number;
  publishedAt?: string | null;
  updatedAt: string;
  createdAt: string;
  draftBlocks?: unknown;
  hasHtml?: boolean;
  draftHtml?: string | null;
  draftTemplate?: ConversionPageTemplate;
  generationStatus?: ConversionGenerationStatus;
  generationMode?: string | null;
  generationError?: string | null;
  lead?: { id: string; companyName: string; category?: string | null; city?: string | null } | null;
}

export interface ConversionPageDetail extends ConversionPageSummary {
  draftBlocks: unknown;
  draftHtml?: string | null;
  versions: Array<{
    id: string;
    version: number;
    title: string;
    changeNote?: string | null;
    createdAt: string;
    createdById?: string | null;
  }>;
}

export interface EntitlementsSnapshot {
  plan: string;
  planStatus: string;
  currentPeriodEnd?: string | null;
  limits: {
    publishedPages: number;
    pageDrafts: number;
    versionHistory: number;
    aiGenerations: number;
  };
  usage: {
    publishedPages: number;
    pageDrafts: number;
    teamMembers: number;
    aiGenerations: number;
  };
  features: Record<string, boolean | number>;
}

export interface PageMetrics {
  pageId: string;
  periodDays: number;
  views: number;
  ctaClicks: number;
  formSubmitted: number;
  conversionRate: number;
  topCtaType: string | null;
  lastConversionAt: string | null;
}

export async function listConversionPages(params?: {
  page?: number;
  leadId?: string;
}): Promise<PaginatedResult<ConversionPageSummary>> {
  const { data } = await api.get<PaginatedResult<ConversionPageSummary>>('/conversion-pages', {
    params,
  });
  return data;
}

export async function getConversionPage(id: string): Promise<ConversionPageDetail> {
  const { data } = await api.get<ConversionPageDetail>(`/conversion-pages/${id}`);
  return data;
}

export async function createConversionPage(input: {
  title: string;
  leadId?: string;
}): Promise<ConversionPageDetail> {
  const { data } = await api.post<ConversionPageDetail>('/conversion-pages', input);
  return data;
}

export async function generateLandingPage(input: {
  leadId?: string;
  describeText?: string;
  googleLink?: string;
  title?: string;
}): Promise<ConversionPageDetail> {
  const { data } = await api.post<ConversionPageDetail>('/conversion-pages/generate', input);
  return data;
}

export async function refineLandingPage(
  id: string,
  input: { instruction: string },
): Promise<ConversionPageDetail> {
  const { data } = await api.post<ConversionPageDetail>(`/conversion-pages/${id}/refine`, input);
  return data;
}

export async function updateConversionPageDraft(
  id: string,
  input: { title?: string; blocks: unknown[]; expectedRevision?: number },
): Promise<ConversionPageDetail> {
  const { data } = await api.patch<ConversionPageDetail>(`/conversion-pages/${id}/draft`, input);
  return data;
}

export async function publishConversionPage(id: string): Promise<ConversionPageDetail> {
  const { data } = await api.post<ConversionPageDetail>(`/conversion-pages/${id}/publish`);
  return data;
}

export async function archiveConversionPage(id: string): Promise<ConversionPageDetail> {
  const { data } = await api.post<ConversionPageDetail>(`/conversion-pages/${id}/archive`);
  return data;
}

export async function restoreConversionPageVersion(
  id: string,
  version: number,
): Promise<ConversionPageDetail> {
  const { data } = await api.post<ConversionPageDetail>(`/conversion-pages/${id}/restore-version`, {
    version,
  });
  return data;
}

export async function fetchPageMetrics(id: string, days = 30): Promise<PageMetrics> {
  const { data } = await api.get<PageMetrics>(`/conversion-pages/${id}/metrics`, {
    params: { days },
  });
  return data;
}

export async function fetchEntitlements(): Promise<EntitlementsSnapshot> {
  const { data } = await api.get<EntitlementsSnapshot>('/conversion-pages/entitlements');
  return data;
}

export async function fetchPublicPage(slug: string): Promise<{
  title: string;
  publicSlug: string;
  version: number;
  html?: string | null;
  template?: ConversionPageTemplate;
  blocks: unknown;
  analytics?: { enabled: boolean; consentLabel: string };
}> {
  const { data } = await api.get(`/public/pages/${slug}`);
  return data;
}

export async function updatePageAnalytics(
  id: string,
  input: { analyticsPixelEnabled?: boolean; analyticsConsentLabel?: string },
) {
  const { data } = await api.patch(`/conversion-pages/${id}/analytics`, input);
  return data;
}

export async function updateConversionPageTemplate(id: string, template: ConversionPageTemplate) {
  const { data } = await api.patch<ConversionPageDetail>(`/conversion-pages/${id}/template`, {
    template,
  });
  return data;
}

export async function listPageAssets(id: string) {
  const { data } = await api.get(`/conversion-pages/${id}/assets`);
  return data;
}

export async function registerPageAsset(id: string, input: { url: string; altText?: string }) {
  const { data } = await api.post(`/conversion-pages/${id}/assets`, input);
  return data;
}

export async function listDomainBindings() {
  const { data } = await api.get('/conversion-pages/domains');
  return data;
}

export async function createDomainBinding(input: { hostname: string; pageId?: string }) {
  const { data } = await api.post('/conversion-pages/domains', input);
  return data;
}

export async function verifyDomainBinding(id: string) {
  const { data } = await api.post(`/conversion-pages/domains/${id}/verify`);
  return data;
}

export async function submitPublicForm(
  slug: string,
  payload: { name?: string; email?: string; phone?: string; message?: string },
): Promise<{ ok: boolean; message?: string }> {
  const { data } = await api.post(`/public/pages/${slug}/forms`, payload);
  return data;
}

export async function trackPublicEvent(
  slug: string,
  input: { type: 'page_view' | 'cta_click' | 'form_started'; ctaType?: string },
): Promise<void> {
  await api.post(`/public/pages/${slug}/events`, input);
}
