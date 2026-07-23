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
export type SearchStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type WebsitePresence = 'NO_WEBSITE_REPORTED' | 'WEBSITE_FOUND' | 'NEEDS_REVIEW';

export interface SearchInput {
  category: ProspectingCategory;
  city: string;
  state: BrazilianStateCode;
  onlyWithoutWebsite: boolean;
}

export interface ProspectingSearch {
  id: string;
  provider: 'OPENSTREETMAP' | string;
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
  state: BrazilianStateCode;
  country: 'BR';
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  source: 'OPENSTREETMAP';
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
