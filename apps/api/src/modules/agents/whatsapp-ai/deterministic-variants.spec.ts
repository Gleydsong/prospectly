import { buildDeterministicWhatsappVariants } from './deterministic-variants';

describe('buildDeterministicWhatsappVariants', () => {
  it('returns requested count with personalized company, city and logged-in sender', () => {
    const variants = buildDeterministicWhatsappVariants(
      {
        companyName: 'Salão Resenha',
        city: 'Recife',
        segment: 'Beleza',
        senderName: 'Gui',
      },
      4,
    );

    expect(variants).toHaveLength(4);
    expect(variants[0]?.angle).toBe('direto');
    expect(variants.every((item) => item.body.includes('Salão Resenha'))).toBe(true);
    expect(variants[0]?.body).toContain('Recife');
    expect(variants[0]?.body).toContain('Gui');
  });

  it('uses dor_site copy without website when missing', () => {
    const variants = buildDeterministicWhatsappVariants(
      { companyName: 'Padaria Norte', website: null },
      5,
    );
    const dor = variants.find((item) => item.angle === 'dor_site');
    expect(dor?.body).toMatch(/presença digital|WhatsApp|descoberta online|canal digital/i);
    expect(dor?.body).not.toMatch(/dei uma olhada rápida no site/i);
  });

  it('rotates packs by seed so regenerate yields different copy', () => {
    const lead = {
      companyName: 'Restaurante Max Matuto',
      city: 'Cabo de Santo Agostinho',
      senderName: 'Ana',
    };
    const a = buildDeterministicWhatsappVariants(lead, 4, 0);
    const b = buildDeterministicWhatsappVariants(lead, 4, 1);
    expect(a[0]?.body).not.toBe(b[0]?.body);
    expect(a[0]?.id).not.toBe(b[0]?.id);
    expect(b.every((item) => item.body.includes('Ana'))).toBe(true);
  });
});
