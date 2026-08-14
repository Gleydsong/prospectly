import { describe, expect, it } from 'vitest';

import { formatCategoryTag } from './format-category-tag';

describe('formatCategoryTag', () => {
  it('uses Portuguese labels with the first letter uppercase', () => {
    expect(formatCategoryTag('restaurant')).toBe('Restaurante');
    expect(formatCategoryTag('cafe')).toBe('Cafeteria');
    expect(formatCategoryTag('bakery')).toBe('Padaria');
    expect(formatCategoryTag('hairdresser')).toBe('Cabeleireiro');
    expect(formatCategoryTag('clinic')).toBe('Clínica');
    expect(formatCategoryTag('clothes')).toBe('Loja de roupas');
  });
});
