import { buildDeterministicWhatsappVariants } from './deterministic-variants';

describe('buildDeterministicWhatsappVariants', () => {
  it('returns requested count with personalized company and city', () => {
    const variants = buildDeterministicWhatsappVariants(
      {
        companyName: 'Salão Resenha',
        city: 'Recife',
        segment: 'Beleza',
        ownerName: 'Gui',
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
    expect(dor?.body).toMatch(/presença digital|WhatsApp/i);
    expect(dor?.body).not.toMatch(/dei uma olhada no site/i);
  });
});
