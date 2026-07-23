import type { NormalizedBusiness } from './normalized-business';

export const BRAZILIAN_STATE_CODES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
  'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
] as const;

export type BrazilianStateCode = (typeof BRAZILIAN_STATE_CODES)[number];

export interface SearchProviderInput {
  category: string;
  city: string;
  state: string;
  onlyWithoutWebsite: boolean;
}

export interface SearchProvider {
  search(input: SearchProviderInput): Promise<NormalizedBusiness[]>;
}

export const OPENSTREETMAP_SEARCH_PROVIDER = 'OPENSTREETMAP_SEARCH_PROVIDER';
