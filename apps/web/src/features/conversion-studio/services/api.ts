import { api } from '@/lib/api';
import type { PaginatedResult } from '@/types';

export type ConversionPageStatus = 'DRAFT' | 'PREVIEW' | 'PUBLISHED' | 'ARCHIVED';

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
  lead?: { id: string; companyName: string } | null;
}

export interface ConversionPageDetail extends ConversionPageSummary {
  draftBlocks: unknown;
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
  };
  usage: {
    publishedPages: number;
    pageDrafts: number;
    teamMembers: number;
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
  blocks: unknown;
}> {
  const { data } = await api.get(`/public/pages/${slug}`);
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
