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

export enum CampaignLeadResult {
  CONTACTED = 'CONTACTED',
  REPLIED = 'REPLIED',
  INTERESTED = 'INTERESTED',
  MEETING = 'MEETING',
  PROPOSAL = 'PROPOSAL',
  WON = 'WON',
  LOST = 'LOST',
  NO_RESPONSE = 'NO_RESPONSE',
  OPT_OUT = 'OPT_OUT',
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

/** Credits charged per paid action after the 3 free Maps/OF runs. ACTIVE plans skip consume.
 *  Keep in sync with apps/api billing.constants CREDIT_COSTS. */
export const CREDIT_COSTS = {
  mapsSearch: 14,
  opportunityFinder: 16,
  explain: 8,
  saveLead: 1,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

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

export type AppLocale = 'pt' | 'en';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  organizationId: string;
  organizationName: string;
  role: Role;
  locale: AppLocale;
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

/** Categories available without an active paid plan. */
export const FREE_PROSPECTING_CATEGORIES = [
  'restaurant',
  'cafe',
  'bakery',
  'hairdresser',
  'clothes',
] as const satisfies readonly ProspectingCategory[];

export type FreeProspectingCategory = (typeof FREE_PROSPECTING_CATEGORIES)[number];

export function isFreeProspectingCategory(value: string): value is FreeProspectingCategory {
  return (FREE_PROSPECTING_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Soft cap on results persisted per search (providers may return fewer).
 * Volume is not user-selectable — each search consumes credits instead.
 */
export const MAX_SEARCH_RESULT_LIMIT = 100;

export const DEFAULT_SEARCH_RESULT_LIMIT = MAX_SEARCH_RESULT_LIMIT;

/** @deprecated Prefer MAX_SEARCH_RESULT_LIMIT. Kept for older persisted search inputs. */
export const SEARCH_RESULT_LIMITS = [20, 40, 60, MAX_SEARCH_RESULT_LIMIT] as const;

export type SearchResultLimit = (typeof SEARCH_RESULT_LIMITS)[number];

export interface ProspectingCategoryOption {
  value: ProspectingCategory;
  label: string;
  available: boolean;
}

export interface ProspectingCategoryCatalog {
  categories: ProspectingCategoryOption[];
  total: number;
  availableCount: number;
  plan: string;
  requiredPlan: string;
}

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
  hasBooking?: boolean;
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
  /** Raw SEO signals (present when HTML was fetched). */
  seo?: SeoSignals;
  issues: Array<{ code: string; severity: 'INFO' | 'WARNING' | 'CRITICAL'; message: string }>;
  error?: string;
}

/** Optional per-call context for the analyzer. */
export interface WebsiteAnalysisContext {
  /** Lead locality, used for local-SEO checks (NAP / city mention). */
  city?: string | null;
  state?: string | null;
  /**
   * Also request robots.txt, sitemap.xml and the www/non-www alternate host
   * (3 extra requests, ~5s budget). Off by default so bulk callers stay cheap.
   */
  includeAuxChecks?: boolean;
}

export interface WebsiteAnalyzer {
  analyze(url: string, context?: WebsiteAnalysisContext): Promise<WebsiteAnalysisResult>;
}

// ---------- SEO audit ----------

export type SeoRenderingMode = 'SSR' | 'CSR' | 'STATIC' | 'UNKNOWN';

export interface SeoImageSignals {
  total: number;
  missingDimensions: number;
  modernFormat: number;
  missingAlt: number;
}

/** Signals extracted from the HTML + auxiliary requests. `undefined` = not determined. */
export interface SeoSignals {
  renderingMode: SeoRenderingMode;
  visibleTextLength: number;
  noindex: boolean;
  canonicalUrl?: string;
  h1Count: number;
  titleLength?: number;
  metaDescriptionLength?: number;
  ogTitle?: string;
  ogImage?: string;
  jsonLdTypes: string[];
  hasMicrodata: boolean;
  images: SeoImageSignals;
  thirdPartyScriptHosts: string[];
  renderBlockingScripts: number;
  hasAddress: boolean;
  mentionsCity?: boolean;
  robotsBlocksAll?: boolean;
  alternateHostRedirects?: boolean;
}

export type SeoVector = 'INDEXABILITY' | 'ON_PAGE' | 'PERFORMANCE' | 'LOCAL_INFRA';
export type SeoSeverity = 'HIGH' | 'MEDIUM' | 'LOW';
export type SeoOpportunityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface SeoFinding {
  code: string;
  vector: SeoVector;
  severity: SeoSeverity;
  points: number;
  quickWin: boolean;
  title: string;
  diagnosis: string;
  impact: string;
  fix: string;
}

export interface SeoAudit {
  healthScore: number;
  opportunity: SeoOpportunityLevel;
  architecture: string;
  vectors: Record<SeoVector, { score: number; max: number }>;
  findings: SeoFinding[];
  topIssues: SeoFinding[];
  quickWins: SeoFinding[];
  signals: SeoSignals;
}

// ---------- Lead scoring (Phase 4) ----------

export interface ScoreRuleDefinition {
  key: string;
  description: string;
  points: number;
  enabled: boolean;
}

export type ScoreDimension = 'fit' | 'opportunity' | 'engagement';

export interface ScoreResult {
  score: number;
  fit: number;
  opportunity: number;
  engagement: number;
  tier: 'LOW' | 'MEDIUM' | 'GOOD' | 'HIGH';
  appliedRules: Array<{ key: string; points: number; dimension: ScoreDimension }>;
  missingData: string[];
  recommendedAction: string;
  configVersion: number;
}

// ---------- Opportunity signals (Conversion Studio) ----------
// Heuristic for discovery cards. Does NOT claim a business has no website.
// NO_WEBSITE_REPORTED means "source did not report a website".

export type OpportunitySignalLevel = 'LOW' | 'MEDIUM' | 'HIGH';

export type OpportunitySignalReasonKey =
  | 'website_not_reported_by_source'
  | 'good_rating_and_volume'
  | 'contact_available'
  | 'not_yet_in_crm'
  | 'already_in_crm'
  | 'website_reported_by_source'
  | 'needs_website_review';

export type OpportunitySignalTag =
  | 'HIGH_POTENTIAL'
  | 'SITE_NOT_REPORTED'
  | 'NEW'
  | 'IN_CRM'
  | 'HAS_CONTACT';

export interface OpportunitySignalInput {
  websitePresence: 'NO_WEBSITE_REPORTED' | 'WEBSITE_FOUND' | 'NEEDS_REVIEW';
  phone?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  inCrm?: boolean;
}

export interface OpportunitySignal {
  level: OpportunitySignalLevel;
  score: number;
  reasons: OpportunitySignalReasonKey[];
  tags: OpportunitySignalTag[];
}

export const OPPORTUNITY_HIGH_RATING = 4;
export const OPPORTUNITY_MIN_REVIEWS = 10;

export function buildOpportunitySignal(input: OpportunitySignalInput): OpportunitySignal {
  const reasons: OpportunitySignalReasonKey[] = [];
  const tags: OpportunitySignalTag[] = [];
  let score = 0;

  const hasContact = Boolean(input.phone?.trim() || input.email?.trim() || input.whatsapp?.trim());
  const rating = typeof input.rating === 'number' ? input.rating : null;
  const reviews = typeof input.reviewCount === 'number' ? input.reviewCount : null;
  const strongSocialProof =
    rating !== null &&
    reviews !== null &&
    rating >= OPPORTUNITY_HIGH_RATING &&
    reviews >= OPPORTUNITY_MIN_REVIEWS;

  if (input.websitePresence === 'NO_WEBSITE_REPORTED') {
    score += 40;
    reasons.push('website_not_reported_by_source');
    tags.push('SITE_NOT_REPORTED');
  } else if (input.websitePresence === 'NEEDS_REVIEW') {
    score += 15;
    reasons.push('needs_website_review');
  } else {
    reasons.push('website_reported_by_source');
  }

  if (strongSocialProof) {
    score += 25;
    reasons.push('good_rating_and_volume');
  }

  if (hasContact) {
    score += 20;
    reasons.push('contact_available');
    tags.push('HAS_CONTACT');
  }

  if (input.inCrm) {
    tags.push('IN_CRM');
    reasons.push('already_in_crm');
  } else {
    score += 15;
    reasons.push('not_yet_in_crm');
    tags.push('NEW');
  }

  const capped = Math.min(100, score);
  const level: OpportunitySignalLevel = capped >= 70 ? 'HIGH' : capped >= 40 ? 'MEDIUM' : 'LOW';
  if (level === 'HIGH') tags.unshift('HIGH_POTENTIAL');

  return { level, score: capped, reasons, tags: [...new Set(tags)] };
}

// ---------- AI Opportunity Finder ----------

export const OPPORTUNITY_RUN_STATUSES = [
  'IDLE', 'PREPARING', 'SEARCHING', 'ANALYZING', 'RANKING',
  'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED',
] as const;

export type OpportunityRunStatus = (typeof OPPORTUNITY_RUN_STATUSES)[number];
export type EvidenceTruth = 'TRUE' | 'FALSE' | 'UNKNOWN';
export type OpportunityEvidenceKind = 'FACT' | 'INFERENCE' | 'RECOMMENDATION' | 'UNKNOWN';

export type OpportunityFinderSignalType =
  | 'MISSING_WEBSITE'
  | 'LOW_PERFORMANCE'
  | 'MISSING_HTTPS'
  | 'MISSING_MOBILE_SUPPORT'
  | 'MISSING_BOOKING'
  | 'MISSING_WHATSAPP'
  | 'MISSING_CONTACT_FORM'
  | 'HIGH_REVIEW_COUNT'
  | 'HIGH_RATING'
  | 'CONTACT_AVAILABLE'
  | 'ACTIVE_BUSINESS';

export interface OpportunityFinderSignal {
  type: OpportunityFinderSignalType;
  value: EvidenceTruth;
  source: 'PROVIDER' | 'WEBSITE_ANALYZER' | 'DETERMINISTIC_RULE';
  confidence: number;
  evidence: string;
  kind: OpportunityEvidenceKind;
  checkedAt: string;
}

export interface OpportunityProfile {
  service: string;
  /** Explicit target niche. Optional for profiles persisted before niche separation. */
  niche?: string;
  targetCustomer: string[];
  relevantSignals: OpportunityFinderSignalType[];
  categories: ProspectingCategory[];
}

export interface OpportunitySearchStrategy {
  categories: ProspectingCategory[];
  minimumRating: number | null;
  minimumReviews: number | null;
  relevantSignals: OpportunityFinderSignalType[];
}

export interface OpportunityDna {
  need: number;
  quality: number;
  reach: number;
  timing: number;
  fit: number;
}

export interface OpportunityScoreReason {
  signal: OpportunityFinderSignalType;
  dimension: keyof OpportunityDna;
  points: number;
  label: string;
}

export interface OpportunityScoreBreakdown {
  version: 'opportunity-score-v1';
  dna: OpportunityDna;
  reasons: OpportunityScoreReason[];
}

export interface OpportunityExplanation {
  summary: string;
  whyOpportunity: string;
  recommendedOffer: string;
  commercialAngle: string;
  warnings: string[];
  source: 'AI' | 'DETERMINISTIC_FALLBACK';
}

export interface OpportunityCompany {
  externalId: string;
  companyName: string;
  category?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city: string;
  state: string;
  country: 'BR';
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
  reviewCount?: number;
  source: 'OPENSTREETMAP' | 'GOOGLE_PLACES';
  websitePresence: 'NO_WEBSITE_REPORTED' | 'WEBSITE_FOUND' | 'NEEDS_REVIEW';
}

export interface OpportunityCandidateView {
  id: string;
  runId: string;
  status: 'DISCOVERED' | 'ANALYZING' | 'SCORED' | 'FAILED';
  company: OpportunityCompany;
  signals: OpportunityFinderSignal[];
  scoreBreakdown: OpportunityScoreBreakdown;
  overallScore: number;
  confidenceScore: number;
  dataCompleteness: number;
  rankingCategory: 'EXCELLENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  explanation?: OpportunityExplanation | null;
  importedLeadId?: string | null;
  analyzedAt?: string | null;
}

export interface OpportunityRunView {
  id: string;
  status: OpportunityRunStatus;
  service: string;
  city: string;
  state: string;
  country: 'BR';
  profile?: OpportunityProfile | null;
  searchStrategy?: OpportunitySearchStrategy | null;
  scoringVersion: string;
  candidateCount: number;
  analyzedCount: number;
  failedCount: number;
  errorCode?: string | null;
  errorMessage?: string | null;
  startedAt: string;
  completedAt?: string | null;
  createdAt: string;
}

export interface CreateOpportunityRunInput {
  service: string;
  /** Optional during the backwards-compatible rollout; the web client always supplies it. */
  niche?: string;
  city: string;
  state: string;
  country?: 'BR';
  idempotencyKey?: string;
}
