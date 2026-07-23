/** Shared domain types and enums between web and api. */

// ---------- Enums ----------

export enum Role {
  OWNER = 'OWNER',
  ADMIN = 'ADMIN',
  SALES = 'SALES',
  MEMBER = 'MEMBER',
  VIEWER = 'VIEWER',
}

export enum LeadStatus {
  NEW = 'NEW',
  TO_REVIEW = 'TO_REVIEW',
  QUALIFIED = 'QUALIFIED',
  DISQUALIFIED = 'DISQUALIFIED',
  CONTACTED = 'CONTACTED',
  RESPONDED = 'RESPONDED',
  MEETING_SCHEDULED = 'MEETING_SCHEDULED',
  PROPOSAL_SENT = 'PROPOSAL_SENT',
  NEGOTIATION = 'NEGOTIATION',
  WON = 'WON',
  LOST = 'LOST',
  ARCHIVED = 'ARCHIVED',
}

export enum LeadSource {
  MANUAL = 'MANUAL',
  CSV_IMPORT = 'CSV_IMPORT',
  GOOGLE_PLACES = 'GOOGLE_PLACES',
  OPENSTREETMAP = 'OPENSTREETMAP',
  YELP = 'YELP',
  REFERRAL = 'REFERRAL',
  OTHER = 'OTHER',
}

export enum ActivityType {
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  WHATSAPP = 'WHATSAPP',
  INSTAGRAM = 'INSTAGRAM',
  MEETING = 'MEETING',
  NOTE = 'NOTE',
  TASK = 'TASK',
  PROPOSAL_SENT = 'PROPOSAL_SENT',
  STATUS_CHANGED = 'STATUS_CHANGED',
  OWNER_CHANGED = 'OWNER_CHANGED',
  STAGE_CHANGED = 'STAGE_CHANGED',
}

export enum TaskPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TaskStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  DONE = 'DONE',
  CANCELLED = 'CANCELLED',
}

export enum CampaignStatus {
  DRAFT = 'DRAFT',
  SCHEDULED = 'SCHEDULED',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ImportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum SearchStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum AnalysisStatus {
  PENDING = 'PENDING',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

// ---------- API contracts ----------

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
  path: string;
  correlationId?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
  role: Role;
}

// ---------- Business search provider (Phase 3) ----------

export const PROSPECTING_CATEGORY_VALUES = [
  'restaurant', 'cafe', 'bar', 'pharmacy', 'hospital', 'clinic', 'supermarket', 'bakery',
  'butcher', 'clothes', 'hairdresser', 'carpenter', 'electrician', 'accountant', 'lawyer',
  'hotel', 'hostel', 'guest_house',
] as const;

export type ProspectingCategory = (typeof PROSPECTING_CATEGORY_VALUES)[number];

export const PROSPECTING_CATEGORIES = [
  { value: 'restaurant', label: 'Restaurante' },
  { value: 'cafe', label: 'Cafeteria' },
  { value: 'bar', label: 'Bar' },
  { value: 'pharmacy', label: 'Farmácia' },
  { value: 'hospital', label: 'Hospital' },
  { value: 'clinic', label: 'Clínica' },
  { value: 'supermarket', label: 'Supermercado' },
  { value: 'bakery', label: 'Padaria' },
  { value: 'butcher', label: 'Açougue' },
  { value: 'clothes', label: 'Loja de roupas' },
  { value: 'hairdresser', label: 'Cabeleireiro' },
  { value: 'carpenter', label: 'Marcenaria' },
  { value: 'electrician', label: 'Eletricista' },
  { value: 'accountant', label: 'Contabilidade' },
  { value: 'lawyer', label: 'Advocacia' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'hostel', label: 'Hostel' },
  { value: 'guest_house', label: 'Pousada' },
] as const satisfies readonly { value: ProspectingCategory; label: string }[];

export interface SearchBusinessesInput {
  query?: string;
  category?: ProspectingCategory;
  country?: string;
  state?: string;
  city?: string;
  postalCode?: string;
  radiusKm?: number;
  hasWebsite?: boolean;
  minRating?: number;
  minReviews?: number;
  maxReviews?: number;
  keywords?: string[];
  page?: number;
  pageSize?: number;
}

export interface BusinessSummary {
  externalId: string;
  name: string;
  category?: string;
  phone?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
}

export interface SearchBusinessesResult {
  results: BusinessSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface BusinessDetails extends BusinessSummary {
  description?: string;
  email?: string;
  whatsapp?: string;
  instagram?: string;
  facebook?: string;
  openingHours?: Record<string, string>;
}

export interface BusinessSearchProvider {
  readonly name: string;
  search(input: SearchBusinessesInput): Promise<SearchBusinessesResult>;
  getDetails(externalId: string): Promise<BusinessDetails>;
}

// ---------- Website analyzer (Phase 4) ----------

export interface WebsiteAnalysisResult {
  url: string;
  accessible: boolean;
  httpStatus?: number;
  https: boolean;
  sslValid?: boolean;
  redirectsToHttps?: boolean;
  responseTimeMs?: number;
  title?: string;
  metaDescription?: string;
  hasViewport?: boolean;
  hasContactForm?: boolean;
  hasPhone?: boolean;
  hasEmail?: boolean;
  hasSocialLinks?: boolean;
  hasWhatsapp?: boolean;
  hasPrivacyPolicy?: boolean;
  hasSitemap?: boolean;
  hasRobotsTxt?: boolean;
  hasFavicon?: boolean;
  hasOpenGraph?: boolean;
  hasStructuredData?: boolean;
  cms?: string;
  framework?: string;
  analytics?: string;
  technologies?: string[];
  issues: Array<{ code: string; severity: 'INFO' | 'WARNING' | 'CRITICAL'; message: string }>;
  error?: string;
}

export interface WebsiteAnalyzer {
  analyze(url: string): Promise<WebsiteAnalysisResult>;
}

// ---------- Lead scoring (Phase 4) ----------

export interface ScoreRuleDefinition {
  key: string;
  description: string;
  points: number;
  enabled: boolean;
}

export interface ScoreResult {
  score: number;
  tier: 'LOW' | 'MEDIUM' | 'GOOD' | 'HIGH';
  appliedRules: Array<{ key: string; points: number }>;
}
