import { classifyBrazilianPhone, hasLikelyWhatsApp } from './brazilian-phone';

describe('classifyBrazilianPhone', () => {
  it('classifies mobile numbers with the ninth digit', () => {
    expect(classifyBrazilianPhone('(11) 99876-5432')).toBe('mobile');
    expect(classifyBrazilianPhone('+55 (11) 99876-5432')).toBe('mobile');
    expect(classifyBrazilianPhone('+5511998765432')).toBe('mobile');
  });

  it('classifies landline numbers', () => {
    expect(classifyBrazilianPhone('(11) 3234-5678')).toBe('landline');
    expect(classifyBrazilianPhone('+551132345678')).toBe('landline');
  });

  it('returns unknown for empty, short or foreign numbers', () => {
    expect(classifyBrazilianPhone('')).toBe('unknown');
    expect(classifyBrazilianPhone(null)).toBe('unknown');
    expect(classifyBrazilianPhone('91')).toBe('unknown');
    expect(classifyBrazilianPhone('+351 21 000 0000')).toBe('unknown');
  });
});

describe('hasLikelyWhatsApp', () => {
  it('is true for mobile phones or an explicit whatsapp field', () => {
    expect(hasLikelyWhatsApp({ phone: '(11) 99876-5432' })).toBe(true);
    expect(hasLikelyWhatsApp({ phone: '(11) 3234-5678', whatsapp: '+5511998765432' })).toBe(true);
  });

  it('is false for landlines without a whatsapp field', () => {
    expect(hasLikelyWhatsApp({ phone: '(11) 3234-5678' })).toBe(false);
    expect(hasLikelyWhatsApp({ phone: '' })).toBe(false);
  });
});
