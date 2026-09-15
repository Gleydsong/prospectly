import { BadRequestException } from '@nestjs/common';

import { normalizePersonaOtherLabel } from './professional-persona';

describe('normalizePersonaOtherLabel', () => {
  it('trims outro labels', () => {
    expect(normalizePersonaOtherLabel('outro', ' Fotógrafo ')).toBe('Fotógrafo');
  });

  it('clears the label when persona is not outro', () => {
    expect(normalizePersonaOtherLabel('vendedor', 'x')).toBeNull();
  });

  it('rejects outro labels shorter than 2 characters', () => {
    expect(() => normalizePersonaOtherLabel('outro', 'a')).toThrow(BadRequestException);
  });

  it('rejects outro without a label', () => {
    expect(() => normalizePersonaOtherLabel('outro', undefined)).toThrow(BadRequestException);
    expect(() => normalizePersonaOtherLabel('outro', '  ')).toThrow(BadRequestException);
  });

  it('rejects outro labels longer than 40 characters', () => {
    expect(() => normalizePersonaOtherLabel('outro', 'x'.repeat(41))).toThrow(BadRequestException);
  });
});
