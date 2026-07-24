import type { LeadSource, LeadStatus, PaginatedResult, ProspectingCategory, Role } from '@prospectly/shared-types';

export type { PaginatedResult, ProspectingCategory };
export {
  LeadStatus,
  LeadSource,
  PROSPECTING_CATEGORIES,
  PROSPECTING_CATEGORY_VALUES,
  Role,
} from '@prospectly/shared-types';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
  role: Role;
}

export interface Tag {
  id: string;
  name: string;
  color?: string | null;
}

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
  lastContactAt?: string | null;
  nextContactAt?: string | null;
  contacts: LeadContact[];
  scores?: Array<{
    id: string;
    score: number;
    tier: string;
    rulesApplied: Array<{ key: string; points: number }>;
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
  conversionRate: number;
  overdueTasks: number;
  upcomingFollowUps: Array<{ id: string; companyName: string; nextContactAt: string }>;
  topOpportunities: Array<{
    id: string;
    companyName: string;
    score: number;
    status: LeadStatus;
    city?: string | null;
  }>;
}

export interface DashboardCharts {
  byStatus: Array<{ status: LeadStatus; count: number }>;
  bySegment: Array<{ segment: string | null; count: number }>;
  byCity: Array<{ city: string | null; count: number }>;
  bySource: Array<{ source: LeadSource; count: number }>;
  byScore: Array<{ bucket: string; count: number }>;
}

export interface PipelineBoard {
  pipeline: { id: string; name: string };
  stages: Array<LeadStage & { order: number; leads: LeadListItem[] }>;
}

export const BRAZILIAN_STATE_CODES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type BrazilianStateCode = (typeof BRAZILIAN_STATE_CODES)[number];

/** Brazil + broad European ISO 3166-1 alpha-2 list for prospecting search. */
export const PROSPECTING_COUNTRY_CODES = [
  'BR',
  'AD', 'AL', 'AT', 'BA', 'BE', 'BG', 'BY', 'CH', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES',
  'FI', 'FR', 'GB', 'GR', 'HR', 'HU', 'IE', 'IS', 'IT', 'LI', 'LT', 'LU', 'LV', 'MC',
  'MD', 'ME', 'MK', 'MT', 'NL', 'NO', 'PL', 'PT', 'RO', 'RS', 'RU', 'SE', 'SI', 'SK',
  'SM', 'UA', 'VA', 'XK',
] as const;

export type ProspectingCountryCode = (typeof PROSPECTING_COUNTRY_CODES)[number];

export const PROSPECTING_COUNTRIES = [
  { value: 'BR', label: 'Brasil' },
  { value: 'AD', label: 'Andorra' },
  { value: 'AL', label: 'Albânia' },
  { value: 'AT', label: 'Áustria' },
  { value: 'BA', label: 'Bósnia e Herzegovina' },
  { value: 'BE', label: 'Bélgica' },
  { value: 'BG', label: 'Bulgária' },
  { value: 'BY', label: 'Bielorrússia' },
  { value: 'CH', label: 'Suíça' },
  { value: 'CY', label: 'Chipre' },
  { value: 'CZ', label: 'Chéquia' },
  { value: 'DE', label: 'Alemanha' },
  { value: 'DK', label: 'Dinamarca' },
  { value: 'EE', label: 'Estónia' },
  { value: 'ES', label: 'Espanha' },
  { value: 'FI', label: 'Finlândia' },
  { value: 'FR', label: 'França' },
  { value: 'GB', label: 'Reino Unido' },
  { value: 'GR', label: 'Grécia' },
  { value: 'HR', label: 'Croácia' },
  { value: 'HU', label: 'Hungria' },
  { value: 'IE', label: 'Irlanda' },
  { value: 'IS', label: 'Islândia' },
  { value: 'IT', label: 'Itália' },
  { value: 'LI', label: 'Listenstaine' },
  { value: 'LT', label: 'Lituânia' },
  { value: 'LU', label: 'Luxemburgo' },
  { value: 'LV', label: 'Letónia' },
  { value: 'MC', label: 'Mónaco' },
  { value: 'MD', label: 'Moldávia' },
  { value: 'ME', label: 'Montenegro' },
  { value: 'MK', label: 'Macedónia do Norte' },
  { value: 'MT', label: 'Malta' },
  { value: 'NL', label: 'Países Baixos' },
  { value: 'NO', label: 'Noruega' },
  { value: 'PL', label: 'Polónia' },
  { value: 'PT', label: 'Portugal' },
  { value: 'RO', label: 'Roménia' },
  { value: 'RS', label: 'Sérvia' },
  { value: 'RU', label: 'Rússia' },
  { value: 'SE', label: 'Suécia' },
  { value: 'SI', label: 'Eslovénia' },
  { value: 'SK', label: 'Eslováquia' },
  { value: 'SM', label: 'San Marino' },
  { value: 'UA', label: 'Ucrânia' },
  { value: 'VA', label: 'Vaticano' },
  { value: 'XK', label: 'Kosovo' },
] as const satisfies readonly { value: ProspectingCountryCode; label: string }[];

export type SearchStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type WebsitePresence = 'NO_WEBSITE_REPORTED' | 'WEBSITE_FOUND' | 'NEEDS_REVIEW';

export interface SearchInput {
  category: ProspectingCategory;
  city: string;
  state: string;
  country: ProspectingCountryCode;
  onlyWithoutWebsite: boolean;
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
