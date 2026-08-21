import { describe, expect, it } from 'vitest';

import { formatLeadAddressLine } from './format-lead-address';

describe('formatLeadAddressLine', () => {
  it('does not append city and state when the postal address already includes them', () => {
    expect(
      formatLeadAddressLine({
        address: 'Av. Ten. Roxana Bonessi, 1692 - Monte das Oliveiras, Manaus - AM, 69093-828',
        city: 'Manaus',
        state: 'AM',
      }),
    ).toBe('Av. Ten. Roxana Bonessi, 1692 - Monte das Oliveiras, Manaus - AM, 69093-828');
  });

  it('appends city and state when the street line has neither', () => {
    expect(
      formatLeadAddressLine({
        address: 'Rua Álvaro Maia, 257',
        city: 'Anamã',
        state: 'AM',
      }),
    ).toBe('Rua Álvaro Maia, 257, Anamã, AM');
  });

  it('returns city and state when address is missing', () => {
    expect(formatLeadAddressLine({ city: 'Recife', state: 'PE' })).toBe('Recife, PE');
  });
});
