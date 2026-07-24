import type { WebsitePresence } from '@prisma/client';

import type { ProspectingCountryCode } from './search-provider';

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
