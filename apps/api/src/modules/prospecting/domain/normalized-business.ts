import type { WebsitePresence } from '@prisma/client';

import type { BrazilianStateCode } from './search-provider';

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
