import type { NormalizedBusiness } from './normalized-business';
import type { ProspectingProviderId } from './search-provider';

/**
 * Phase 2.2 hook: selective enrichment after cheap discovery (OSM / Places Text Search).
 * Business rules must depend on this interface, not on raw Google/OSM payloads.
 */
export type EnrichmentField =
  | 'operationalStatus'
  | 'rating'
  | 'reviewCount'
  | 'phone'
  | 'website'
  | 'address';

export interface LeadEnrichmentRequest {
  organizationId: string;
  leadId: string;
  externalId: string;
  provider: ProspectingProviderId;
  fields: EnrichmentField[];
}

export interface EnrichmentCostEstimate {
  /** Logical cost units for UI preview before a paid detail call. */
  estimatedUnits: number;
  currency: 'LOGICAL';
  provider: ProspectingProviderId;
}

export interface LeadEnrichmentResult {
  provider: ProspectingProviderId;
  costUnits: number;
  patch: Partial<
    Pick<
      NormalizedBusiness,
      'phone' | 'email' | 'website' | 'address' | 'websitePresence' | 'postalCode' | 'latitude' | 'longitude'
    >
  > & {
    rating?: number;
    reviewCount?: number;
    operationalStatus?: string;
  };
}

export interface LeadEnrichmentProvider {
  readonly id: ProspectingProviderId;
  estimateCost(request: LeadEnrichmentRequest): Promise<EnrichmentCostEstimate>;
  enrich(request: LeadEnrichmentRequest): Promise<LeadEnrichmentResult>;
}

export const LEAD_ENRICHMENT_PROVIDER = 'LEAD_ENRICHMENT_PROVIDER';
