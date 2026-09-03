import { firstNameFrom, formatCredits, formatCurrencyFromCentavos, greeting } from './email-format';

describe('email-format', () => {
  it('extracts the first name and ignores extra spaces', () => {
    expect(firstNameFrom('  Ana Clara Souza  ')).toBe('Ana');
  });

  it('handles missing and long names', () => {
    expect(firstNameFrom(undefined)).toBe('');
    expect(firstNameFrom(null)).toBe('');
    expect(firstNameFrom('A'.repeat(200)).length).toBe(80);
  });

  it('builds a greeting without a name', () => {
    expect(greeting('pt')).toBe('Olá.');
    expect(greeting('en')).toBe('Hi.');
  });

  it('formats credits and currency for pt-BR', () => {
    expect(formatCredits(5000, 'pt')).toBe('5.000');
    expect(formatCurrencyFromCentavos(2399, 'BRL', 'pt')).toContain('23,99');
  });

  it('formats large credit quantities', () => {
    expect(formatCredits(1_250_000, 'pt')).toBe('1.250.000');
  });
});
