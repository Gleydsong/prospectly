import type {
  LeadSource,
  LeadStatus,
  OpportunityCandidateView,
  OpportunityRunView,
  CreateOpportunityRunInput,
  PaginatedResult,
  ProspectingCategory,
  ProspectingCategoryCatalog,
  ProspectingCategoryOption,
  Role,
  SearchResultLimit,
} from '@prospectly/shared-types';

export type {
  PaginatedResult,
  OpportunityCandidateView,
  OpportunityRunView,
  CreateOpportunityRunInput,
  ProspectingCategory,
  ProspectingCategoryCatalog,
  ProspectingCategoryOption,
  SearchResultLimit,
};
export {
  CREDIT_COSTS,
  DEFAULT_SEARCH_RESULT_LIMIT,
  FREE_PROSPECTING_CATEGORIES,
  LeadStatus,
  LeadSource,
  MAX_SEARCH_RESULT_LIMIT,
  PROSPECTING_CATEGORIES,
  PROSPECTING_CATEGORY_VALUES,
  Role,
  SEARCH_RESULT_LIMITS,
} from '@prospectly/shared-types';

export type AppLocale = 'pt' | 'en';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
  role: Role;
  avatarUrl?: string | null;
  /** Present after login/register; may be missing in older persisted sessions. */
  locale?: AppLocale;
  emailVerifiedAt?: string | null;
}

export interface Tag {
  id: string;
  name: string;
  color?: string | null;
}

export type WebsitePresence = 'NO_WEBSITE_REPORTED' | 'WEBSITE_FOUND' | 'NEEDS_REVIEW';
export type ConfidenceLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export interface LeadOwner {
  id: string;
  name: string;
  email?: string;
}

export interface LeadStage {
  id: string;
  name: string;
  color?: string | null;
}

export interface LeadListItem {
  id: string;
  companyName: string;
  tradeName?: string | null;
  category?: string | null;
  segment?: string | null;
  city?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  domain?: string | null;
  status: LeadStatus;
  source: LeadSource;
  score: number;
  rating?: number | null;
  reviewCount?: number | null;
  doNotContact: boolean;
  owner?: LeadOwner | null;
  stage?: LeadStage | null;
  tags: Tag[];
  createdAt: string;
  updatedAt: string;
}

export interface LeadContact {
  id: string;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  isPrimary: boolean;
}

export interface LeadDetail extends LeadListItem {
  description?: string | null;
  whatsapp?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  linkedin?: string | null;
  address?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  notes?: string | null;
  websitePresence?: WebsitePresence;
  websiteStatusReason?: string | null;
  confidenceLevel?: ConfidenceLevel | null;
  dataCollectedAt?: string | null;
  lastVerifiedAt?: string | null;
  missingFields?: string[];
  lastContactAt?: string | null;
  nextContactAt?: string | null;
  contacts: LeadContact[];
  scores?: Array<{
    id: string;
    score: number;
    fit: number;
    opportunity: number;
    engagement: number;
    tier: string;
    rulesApplied: Array<{ key: string; points: number; dimension?: string }>;
    missingData?: string[];
    recommendedAction?: string | null;
    configVersion: number;
    calculatedAt: string;
  }>;
  websiteRecord?: {
    id: string;
    url: string;
    analyses: Array<{
      id: string;
      status: string;
      httpStatus?: number | null;
      https?: boolean | null;
      responseTimeMs?: number | null;
      title?: string | null;
      metaDescription?: string | null;
      hasViewport?: boolean | null;
      hasContactForm?: boolean | null;
      completedAt?: string | null;
      issues: Array<{ id: string; code: string; severity: string; message: string }>;
    }>;
  } | null;
}

export interface Activity {
  id: string;
  type: string;
  description?: string | null;
  outcome?: string | null;
  nextAction?: string | null;
  followUpAt?: string | null;
  createdAt: string;
  user: { id: string; name: string };
}

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  dueAt?: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';
  assignee?: { id: string; name: string } | null;
  lead?: { id: string; companyName: string } | null;
  createdAt: string;
}

export interface DashboardSummary {
  totalLeads: number;
  newLeads: number;
  qualified: number;
  contacted: number;
  meetings: number;
  proposals: number;
  won: number;
  lost: number;
  conversionRate: number;
  lossRate?: number;
  approachRate?: number;
  meetingRate?: number;
  followUpRate?: number;
  rates?: {
    approachRate: number;
    meetingRate: number;
    followUpRate: number;
    conversionRate: number;
    lossRate: number;
    period: DashboardPeriod;
  };
  overdueTasks: number;
  overdueFollowUps: Array<{ id: string; companyName: string; nextContactAt: string }>;
  upcomingFollowUps: Array<{ id: string; companyName: string; nextContactAt: string }>;
  topOpportunities: Array<{
    id: string;
    companyName: string;
    score: number;
    status: LeadStatus;
    city?: string | null;
  }>;
  conversionBySource: Array<{
    source: LeadSource;
    total: number;
    won: number;
    lost: number;
    conversionRate: number;
  }>;
  recommendations?: Array<{
    code: 'HIGH_POTENTIAL_IDLE' | 'STALE_LEADS' | 'OVERDUE_FOLLOW_UPS' | 'FREE_SEARCH_QUOTA';
    count: number;
    href: string;
    severity: 'info' | 'warning' | 'action';
  }>;
  filters?: {
    period: '7d' | '30d' | '90d' | 'all';
    source: LeadSource | null;
    ownerId: string | null;
    segment: string | null;
  };
}

export type DashboardPeriod = '7d' | '30d' | '90d' | 'all';

export interface DashboardFilters {
  period?: DashboardPeriod;
  source?: LeadSource;
  ownerId?: string;
  segment?: string;
}

export interface IntegrationWebhook {
  id: string;
  provider: string;
  status: string;
  url: string | null;
  label: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadExportResult {
  filename: string;
  rowCount: number;
  columns: string[];
  csv: string;
}

export interface DashboardMapPin {
  id: string;
  companyName: string;
  city?: string | null;
  latitude: number;
  longitude: number;
  score: number;
  status: LeadStatus;
}

export interface DashboardCharts {
  byStatus: Array<{ status: LeadStatus; count: number }>;
  bySegment: Array<{ segment: string | null; count: number }>;
  byCity: Array<{ city: string | null; count: number }>;
  bySource: Array<{ source: LeadSource; count: number }>;
  byScore: Array<{ bucket: string; count: number }>;
  mapPins?: DashboardMapPin[];
}

export interface PipelineBoardStage extends LeadStage {
  order: number;
  leads: LeadListItem[];
  totalCount: number;
  hasMore: boolean;
}

export interface PipelineBoard {
  pipeline: { id: string; name: string };
  stages: PipelineBoardStage[];
  limit: number;
  offset: number;
}

export interface PipelineStageLeadsPage {
  stage: LeadStage;
  leads: LeadListItem[];
  totalCount: number;
  hasMore: boolean;
  limit: number;
  offset: number;
}

export const BRAZILIAN_STATE_CODES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type BrazilianStateCode = (typeof BRAZILIAN_STATE_CODES)[number];

/** Brazil-only prospecting (ISO 3166-1 alpha-2). */
export const PROSPECTING_COUNTRY_CODES = ['BR'] as const;

export type ProspectingCountryCode = (typeof PROSPECTING_COUNTRY_CODES)[number];

export const PROSPECTING_COUNTRIES = [
  { value: 'BR', label: 'Brasil' },
] as const satisfies readonly { value: ProspectingCountryCode; label: string }[];

export type SearchStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface SearchInput {
  categories: ProspectingCategory[];
  category?: ProspectingCategory;
  city: string;
  neighborhood?: string;
  state: string;
  country: ProspectingCountryCode;
  onlyWithoutWebsite: boolean;
  /** @deprecated Ignored by API — volume is system-capped; searches consume credits. */
  limit?: SearchResultLimit;
  provider?: 'OPENSTREETMAP' | 'GOOGLE_PLACES';
}

export interface SearchProviderInfo {
  id: 'OPENSTREETMAP' | 'GOOGLE_PLACES';
  label: string;
  available: boolean;
}

export interface ProspectingSearch {
  id: string;
  provider: 'OPENSTREETMAP' | 'GOOGLE_PLACES' | string;
  input: SearchInput;
  status: SearchStatus;
  error?: string | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface NormalizedBusiness {
  externalId: string;
  companyName: string;
  category?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city: string;
  state: string;
  country: ProspectingCountryCode;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  source: 'OPENSTREETMAP' | 'GOOGLE_PLACES';
  websitePresence: WebsitePresence;
}

export interface ProspectingSearchResult {
  id: string;
  externalId?: string | null;
  data: NormalizedBusiness;
  normalizedData: NormalizedBusiness;
  websitePresence: WebsitePresence;
  importedLeadId?: string | null;
  createdAt: string;
}

export interface SearchImportSummary {
  imported: number;
  skipped: number;
  invalid: number;
  conflicts: number;
  items?: Array<{
    resultId: string;
    status: 'IMPORTED' | 'SKIPPED' | 'INVALID' | 'CONFLICT';
    leadId?: string;
    companyName?: string;
  }>;
}

export const CSV_IMPORT_FIELDS = [
  'companyName',
  'phone',
  'email',
  'website',
  'category',
  'address',
  'city',
  'state',
  'postalCode',
  'notes',
  'tags',
] as const;

export type CsvImportField = (typeof CSV_IMPORT_FIELDS)[number];
export type CsvImportStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type CsvImportMapping = Partial<Record<CsvImportField, string>>;

export interface CsvPreview {
  headers: string[];
  rows: Array<Record<string, string>>;
  suggestedMapping: CsvImportMapping;
}

export interface CsvImport {
  id: string;
  fileName: string;
  status: CsvImportStatus;
  totalRows: number;
  importedCount: number;
  skippedCount: number;
  invalidCount: number;
  mapping?: CsvImportMapping | null;
  createdAt: string;
  completedAt?: string | null;
}

export interface CsvImportError {
  id: string;
  row: number;
  message: string;
  data?: Record<string, string> | null;
  createdAt: string;
}
