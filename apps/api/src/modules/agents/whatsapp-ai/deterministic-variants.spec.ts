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

  it('generates follow-up copy when sequenceStage is FOLLOW_UP_1', () => {
    const variants = buildDeterministicWhatsappVariants(
      {
        companyName: 'Clínica Sorriso',
        city: 'Recife',
        senderName: 'Carlos',
        sequenceStage: 'FOLLOW_UP_1',
      },
      3,
    );

    expect(variants).toHaveLength(3);
    expect(variants.some((v) => v.body.match(/conseguiu ver|mensagem anterior|passando só pra|lembrete/i))).toBe(true);
  });

  it('generates breakup copy when sequenceStage is BREAKUP', () => {
    const variants = buildDeterministicWhatsappVariants(
      {
        companyName: 'Boutique Flor',
        city: 'Recife',
        senderName: 'Carlos',
        sequenceStage: 'BREAKUP',
      },
      3,
    );

    expect(variants).toHaveLength(3);
    expect(variants.some((v) => v.body.match(/não vou insistir|último contato|prioridade agora|fico à disposição/i))).toBe(true);
  });

  it('tailors dor_site when audit signals show missing whatsapp on site', () => {
    const variants = buildDeterministicWhatsappVariants(
      {
        companyName: 'Advocacia Silva',
        website: 'https://silva.adv.br',
        auditSignals: { hasWhatsappOnSite: false },
      },
      5,
    );

    const dor = variants.find((v) => v.angle === 'dor_site');
    expect(dor?.body).toMatch(/botão de WhatsApp|WhatsApp direto no site|canal direto de WhatsApp/i);
  });
});

