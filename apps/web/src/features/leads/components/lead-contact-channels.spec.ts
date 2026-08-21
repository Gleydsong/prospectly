import { describe, expect, it } from 'vitest';

import {
  buildWhatsAppHref,
  buildWhatsAppOutreachMessage,
  toWhatsAppDigits,
} from './lead-contact-channels';

describe('lead-contact-channels', () => {
  it('normalizes phone digits for wa.me', () => {
    expect(toWhatsAppDigits('+351 912 345 678')).toBe('351912345678');
    expect(toWhatsAppDigits('91')).toBeNull();
  });

  it('builds outreach message with recommended action when present', () => {
    const msg = buildWhatsAppOutreachMessage({
      companyName: 'Barbearia Norte',
      city: 'Porto',
      recommendedAction: 'Oferecer site one-page com booking.',
    });
    expect(msg).toContain('Barbearia Norte');
    expect(msg).toContain('Porto');
    expect(msg).toContain('booking');
  });

  it('does not leak scoring action codes into the WhatsApp message', () => {
    const msg = buildWhatsAppOutreachMessage({
      companyName: 'Café da Ana - am',
      city: 'Manaus',
      recommendedAction: 'PRIORITIZE_OUTREACH',
    });
    expect(msg).not.toContain('PRIORITIZE_OUTREACH');
    expect(msg).toContain('Priorizar contato comercial');
    expect(buildWhatsAppHref('+5592984863168', msg)).not.toContain('PRIORITIZE_OUTREACH');
  });

  it('builds wa.me href with encoded text', () => {
    const href = buildWhatsAppHref('+351912345678', 'Olá! Teste');
    expect(href).toBe('https://wa.me/351912345678?text=Ol%C3%A1!%20Teste');
  });
});
